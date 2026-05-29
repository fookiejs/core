package outbox

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"testing"

	"github.com/fookiejs/fookie/internal/persistence/store"
	"github.com/jackc/pgx/v5"
)

func testOutboxDB(t *testing.T) (*store.DB, pgx.Tx) {
	t.Helper()
	conn := os.Getenv("FOOKIE_TEST_DATABASE_URL")
	if conn == "" {
		conn = os.Getenv("FOOKIE_DB_URL")
	}
	if conn == "" {
		t.Skip("FOOKIE_TEST_DATABASE_URL or FOOKIE_DB_URL not set")
	}
	d, err := store.Open(conn)
	if err != nil {
		t.Skipf("postgres unavailable: %v", err)
	}
	t.Cleanup(func() {
		d.Pool.Close()
	})
	ctx := context.Background()
	if err := Migrate(d.Pool); err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	_, err = d.Pool.Exec(ctx, `DELETE FROM fookie_outbox WHERE name LIKE 'test_%'`)
	if err != nil {
		t.Fatalf("cleanup outbox: %v", err)
	}
	tx, err := d.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = tx.Rollback(ctx)
	})
	return d, tx
}

func TestOutboxInsert_DedupesByExternalID(t *testing.T) {
	_, tx := testOutboxDB(t)
	externalID := BusinessExternalID("test_PayGateway", "ref-dedupe")
	input := []byte(`{"reference":"ref-dedupe","amount":100}`)
	if err := Insert(tx, "test_PayGateway", externalID, input, RetryPolicy{Attempts: 3}); err != nil {
		t.Fatal(err)
	}
	if err := Insert(tx, "test_PayGateway", externalID, input, RetryPolicy{Attempts: 3}); err != nil {
		t.Fatal(err)
	}
	entry, err := Lookup(tx, externalID)
	if err != nil {
		t.Fatal(err)
	}
	if entry == nil {
		t.Fatal("expected outbox entry")
	}
	if entry.Status != StatusPending {
		t.Fatalf("status=%q", entry.Status)
	}
}

func TestOutboxInsert_ReferenceExternalIDSharedAcrossRetries(t *testing.T) {
	_, tx := testOutboxDB(t)
	input1 := []byte(`{"reference":"retry-ref","amount":1}`)
	input2 := []byte(`{"reference":"retry-ref","amount":999}`)
	key1, err := ExternalID("entity-first", "test_PayGateway", input1)
	if err != nil {
		t.Fatal(err)
	}
	key2, err := ExternalID("entity-retry", "test_PayGateway", input2)
	if err != nil {
		t.Fatal(err)
	}
	if key1 != key2 {
		t.Fatalf("reference keys should match: %q vs %q", key1, key2)
	}
	if err := Insert(tx, "test_PayGateway", key1, input1, RetryPolicy{Attempts: 3}); err != nil {
		t.Fatal(err)
	}
	if err := Insert(tx, "test_PayGateway", key2, input2, RetryPolicy{Attempts: 3}); err != nil {
		t.Fatal(err)
	}
	entry, err := Lookup(tx, key1)
	if err != nil {
		t.Fatal(err)
	}
	if entry == nil {
		t.Fatal("expected single deduped entry")
	}
}

func TestOutboxAddWaiter_Idempotent(t *testing.T) {
	_, tx := testOutboxDB(t)
	externalID, err := ExternalID("entity-w", "test_Notify", []byte(`{"to":"u1"}`))
	if err != nil {
		t.Fatal(err)
	}
	if err := Insert(tx, "test_Notify", externalID, []byte(`{"to":"u1"}`), RetryPolicy{Attempts: 3}); err != nil {
		t.Fatal(err)
	}
	if err := AddWaiter(tx, externalID, "test_Transfer", "entity-w"); err != nil {
		t.Fatal(err)
	}
	if err := AddWaiter(tx, externalID, "test_Transfer", "entity-w"); err != nil {
		t.Fatal(err)
	}
}

func TestOutboxCompleteAndFail(t *testing.T) {
	d, tx := testOutboxDB(t)
	ctx := context.Background()
	externalID, err := ExternalID("entity-c", "test_Svc", []byte(`{"n":1}`))
	if err != nil {
		t.Fatal(err)
	}
	if err := Insert(tx, "test_Svc", externalID, []byte(`{"n":1}`), RetryPolicy{Attempts: 3}); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	output := []byte(`{"ok":true}`)
	if err := Complete(ctx, d.Pool, externalID, output); err != nil {
		t.Fatal(err)
	}
	entry, err := outboxLookupFromPool(ctx, d.Pool, externalID)
	if err != nil {
		t.Fatal(err)
	}
	if entry.Status != StatusCompleted {
		t.Fatalf("status=%q want completed", entry.Status)
	}
	if !jsonEqual(entry.Output, output) {
		t.Fatalf("output=%s want %s", entry.Output, output)
	}
}

func jsonEqual(a, b []byte) bool {
	var va, vb any
	if err := json.Unmarshal(a, &va); err != nil {
		return false
	}
	if err := json.Unmarshal(b, &vb); err != nil {
		return false
	}
	ra, _ := json.Marshal(va)
	rb, _ := json.Marshal(vb)
	return string(ra) == string(rb)
}

func outboxLookupFromPool(ctx context.Context, pool interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, externalID string) (*Entry, error) {
	row := pool.QueryRow(ctx,
		`SELECT id, name, external_id, input, output, status, attempts, max_attempts, next_retry, COALESCE(error_msg,'')
		 FROM fookie_outbox WHERE external_id = $1`, externalID)
	var e Entry
	err := row.Scan(&e.ID, &e.Name, &e.ExternalID, &e.Input, &e.Output,
		&e.Status, &e.Attempts, &e.MaxAttempts, &e.NextRetry, &e.ErrorMsg)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("outbox scan: %w", err)
	}
	return &e, nil
}
