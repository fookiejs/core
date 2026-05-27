package fookie

import (
	"context"
	"encoding/json"
	"os"
	"testing"

	"github.com/jackc/pgx/v5"
)

func testOutboxDB(t *testing.T) (*db, pgx.Tx) {
	t.Helper()
	conn := os.Getenv("FOOKIE_TEST_DATABASE_URL")
	if conn == "" {
		conn = os.Getenv("DB_URL")
	}
	if conn == "" {
		t.Skip("FOOKIE_TEST_DATABASE_URL or DB_URL not set")
	}
	d, err := openDB(conn)
	if err != nil {
		t.Skipf("postgres unavailable: %v", err)
	}
	t.Cleanup(func() {
		d.pool.Close()
	})
	ctx := context.Background()
	if err := d.migrateOutbox(); err != nil {
		t.Fatalf("migrateOutbox: %v", err)
	}
	_, err = d.pool.Exec(ctx, `DELETE FROM fookie_outbox WHERE name LIKE 'test_%'`)
	if err != nil {
		t.Fatalf("cleanup outbox: %v", err)
	}
	tx, err := d.begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = tx.Rollback(ctx)
	})
	return d, tx
}

func TestOutboxInsert_DedupesByCallKey(t *testing.T) {
	_, tx := testOutboxDB(t)
	callKey := outboxBusinessCallKey("test_PayGateway", "ref-dedupe")
	input := []byte(`{"reference":"ref-dedupe","amount":100}`)
	if err := outboxInsert(tx, "test_PayGateway", callKey, input, Retry{Attempts: 3}); err != nil {
		t.Fatal(err)
	}
	if err := outboxInsert(tx, "test_PayGateway", callKey, input, Retry{Attempts: 3}); err != nil {
		t.Fatal(err)
	}
	entry, err := outboxLookup(tx, callKey)
	if err != nil {
		t.Fatal(err)
	}
	if entry == nil {
		t.Fatal("expected outbox entry")
	}
	if entry.Status != outboxStatusPending {
		t.Fatalf("status=%q", entry.Status)
	}
}

func TestOutboxInsert_ReferenceCallKeySharedAcrossRetries(t *testing.T) {
	_, tx := testOutboxDB(t)
	input1 := []byte(`{"reference":"retry-ref","amount":1}`)
	input2 := []byte(`{"reference":"retry-ref","amount":999}`)
	key1, err := outboxCallKey("entity-first", "test_PayGateway", input1)
	if err != nil {
		t.Fatal(err)
	}
	key2, err := outboxCallKey("entity-retry", "test_PayGateway", input2)
	if err != nil {
		t.Fatal(err)
	}
	if key1 != key2 {
		t.Fatalf("reference keys should match: %q vs %q", key1, key2)
	}
	if err := outboxInsert(tx, "test_PayGateway", key1, input1, Retry{Attempts: 3}); err != nil {
		t.Fatal(err)
	}
	if err := outboxInsert(tx, "test_PayGateway", key2, input2, Retry{Attempts: 3}); err != nil {
		t.Fatal(err)
	}
	entry, err := outboxLookup(tx, key1)
	if err != nil {
		t.Fatal(err)
	}
	if entry == nil {
		t.Fatal("expected single deduped entry")
	}
}

func TestOutboxAddWaiter_Idempotent(t *testing.T) {
	_, tx := testOutboxDB(t)
	callKey, err := outboxCallKey("entity-w", "test_Notify", []byte(`{"to":"u1"}`))
	if err != nil {
		t.Fatal(err)
	}
	if err := outboxInsert(tx, "test_Notify", callKey, []byte(`{"to":"u1"}`), Retry{Attempts: 3}); err != nil {
		t.Fatal(err)
	}
	if err := outboxAddWaiter(tx, callKey, "test_Transfer", "entity-w"); err != nil {
		t.Fatal(err)
	}
	if err := outboxAddWaiter(tx, callKey, "test_Transfer", "entity-w"); err != nil {
		t.Fatal(err)
	}
}

func TestOutboxCompleteAndFail(t *testing.T) {
	d, tx := testOutboxDB(t)
	ctx := context.Background()
	callKey, err := outboxCallKey("entity-c", "test_Svc", []byte(`{"n":1}`))
	if err != nil {
		t.Fatal(err)
	}
	if err := outboxInsert(tx, "test_Svc", callKey, []byte(`{"n":1}`), Retry{Attempts: 3}); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	output := []byte(`{"ok":true}`)
	if err := outboxComplete(ctx, d.pool, callKey, output); err != nil {
		t.Fatal(err)
	}
	entry, err := outboxLookupFromPool(ctx, d.pool, callKey)
	if err != nil {
		t.Fatal(err)
	}
	if entry.Status != outboxStatusCompleted {
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
}, callKey string) (*outboxEntry, error) {
	row := pool.QueryRow(ctx,
		`SELECT id, name, call_key, input, output, status, attempts, max_attempts, next_retry, COALESCE(error_msg,'')
		 FROM fookie_outbox WHERE call_key = $1`, callKey)
	var e outboxEntry
	err := row.Scan(&e.ID, &e.Name, &e.CallKey, &e.Input, &e.Output,
		&e.Status, &e.Attempts, &e.MaxAttempts, &e.NextRetry, &e.ErrorMsg)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &e, nil
}
