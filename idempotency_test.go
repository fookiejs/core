package fookie

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/fookiejs/fookie/semantic"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

type mockRows struct {
	descs []pgconn.FieldDescription
	data  [][]any
	idx   int
	err   error
}

func (m *mockRows) Close()                                       {}
func (m *mockRows) Err() error                                   { return m.err }
func (m *mockRows) CommandTag() pgconn.CommandTag                { return pgconn.CommandTag{} }
func (m *mockRows) FieldDescriptions() []pgconn.FieldDescription { return m.descs }
func (m *mockRows) Next() bool {
	if m.idx >= len(m.data) {
		return false
	}
	m.idx++
	return true
}
func (m *mockRows) Scan(dest ...any) error { return nil }
func (m *mockRows) Values() ([]any, error) {
	if m.idx == 0 || m.idx > len(m.data) {
		return nil, fmt.Errorf("no current row")
	}
	return m.data[m.idx-1], nil
}
func (m *mockRows) RawValues() [][]byte { return nil }
func (m *mockRows) Conn() *pgx.Conn     { return nil }

type mockQuerier struct {
	rows pgx.Rows
	err  error
	sql  string
	args []any
}

func (q *mockQuerier) Query(_ context.Context, sql string, args ...any) (pgx.Rows, error) {
	q.sql = sql
	q.args = args
	if q.err != nil {
		return nil, q.err
	}
	return q.rows, nil
}

func idemTestModel() *storedModel {
	return &storedModel{
		name: "IdemOrder",
		fields: []FieldDef{
			{Name: "id", Kind: idKind},
			{Name: "reference", Kind: stringKind, Unique: true},
			{Name: "amount", Kind: currencyKind},
		},
	}
}

func TestFindExistingByUniqueFields_NoUniqueInBody(t *testing.T) {
	model := idemTestModel()
	got, err := findExistingByUniqueFields(context.Background(), &mockQuerier{}, model, map[string]any{"amount": int64(100)})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil, got %+v", got)
	}
}

func TestFindExistingByUniqueFields_EmptyStringSkipped(t *testing.T) {
	model := idemTestModel()
	got, err := findExistingByUniqueFields(context.Background(), &mockQuerier{}, model, map[string]any{"reference": ""})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil for empty reference, got %+v", got)
	}
}

func TestFindExistingByUniqueFields_NoMatch(t *testing.T) {
	model := idemTestModel()
	mq := &mockQuerier{rows: &mockRows{descs: []pgconn.FieldDescription{{Name: "id"}, {Name: "reference"}}}}
	got, err := findExistingByUniqueFields(context.Background(), mq, model, map[string]any{"reference": "ref-1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil, got %+v", got)
	}
	if !strings.Contains(mq.sql, `"reference" = $1`) {
		t.Fatalf("unexpected sql: %s", mq.sql)
	}
	if len(mq.args) != 1 || mq.args[0] != "ref-1" {
		t.Fatalf("unexpected args: %v", mq.args)
	}
}

func TestFindExistingByUniqueFields_Match(t *testing.T) {
	model := idemTestModel()
	mq := &mockQuerier{rows: &mockRows{
		descs: []pgconn.FieldDescription{{Name: "id"}, {Name: "reference"}, {Name: "_fookie_status"}},
		data:  [][]any{{"ent-1", "ref-1", entityStatusActive}},
	}}
	got, err := findExistingByUniqueFields(context.Background(), mq, model, map[string]any{"reference": "ref-1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if got == nil {
		t.Fatal("expected row")
	}
	if got["id"] != "ent-1" {
		t.Fatalf("id=%v want ent-1", got["id"])
	}
	if got["_fookie_status"] != entityStatusActive {
		t.Fatalf("status=%v want active", got["_fookie_status"])
	}
}

func TestFindExistingByUniqueFields_QueryError(t *testing.T) {
	model := idemTestModel()
	want := errors.New("db down")
	got, err := findExistingByUniqueFields(context.Background(), &mockQuerier{err: want}, model, map[string]any{"reference": "ref-1"})
	if !errors.Is(err, want) {
		t.Fatalf("expected db error, got %v", err)
	}
	if got != nil {
		t.Fatalf("expected nil row, got %+v", got)
	}
}

func TestFindExistingByUniqueFields_MultipleUniqueFields(t *testing.T) {
	model := &storedModel{
		name: "PairOrder",
		fields: []FieldDef{
			{Name: "reference", Kind: stringKind, Unique: true},
			{Name: "tenant", Kind: stringKind, Unique: true},
		},
	}
	mq := &mockQuerier{rows: &mockRows{descs: []pgconn.FieldDescription{{Name: "reference"}, {Name: "tenant"}}}}
	_, err := findExistingByUniqueFields(context.Background(), mq, model, map[string]any{"reference": "r1", "tenant": "t1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(mq.sql, `"reference" = $1`) || !strings.Contains(mq.sql, `"tenant" = $2`) {
		t.Fatalf("expected AND clause, got %s", mq.sql)
	}
	if len(mq.args) != 2 {
		t.Fatalf("args=%v want 2", mq.args)
	}
}

type idemPayInput struct {
	Reference semantic.String
	Amount    semantic.Currency
}

func TestOutboxBusinessCallKey_Deterministic(t *testing.T) {
	a := outboxBusinessCallKey("PayGateway", "ref-abc")
	b := outboxBusinessCallKey("PayGateway", "ref-abc")
	if a != b || a == "" {
		t.Fatalf("expected stable non-empty key, got %q and %q", a, b)
	}
}

func TestOutboxBusinessCallKey_DifferentBusinessKeys(t *testing.T) {
	a := outboxBusinessCallKey("PayGateway", "ref-1")
	b := outboxBusinessCallKey("PayGateway", "ref-2")
	if a == b {
		t.Fatal("expected different keys for different business keys")
	}
}

func TestOutboxBusinessCallKey_DifferentServices(t *testing.T) {
	a := outboxBusinessCallKey("PayGateway", "ref-1")
	b := outboxBusinessCallKey("FraudScore", "ref-1")
	if a == b {
		t.Fatal("expected different keys for different services")
	}
}

func TestBusinessReferenceFromInput(t *testing.T) {
	cases := []struct {
		in      string
		want    string
		hasRef  bool
		wantErr bool
	}{
		{`{"reference":"pay-001","amount":100}`, "pay-001", true, false},
		{`{"reference":"  pay-002  "}`, "pay-002", true, false},
		{`{"amount":100}`, "", false, false},
		{`{"reference":""}`, "", false, false},
		{`{"reference":"   "}`, "", false, false},
		{`{bad`, "", false, true},
		{`{"reference":42}`, "", false, true},
	}
	for _, c := range cases {
		got, hasRef, err := businessReferenceFromInput([]byte(c.in))
		if c.wantErr {
			if err == nil {
				t.Fatalf("input=%s expected error", c.in)
			}
			continue
		}
		if err != nil {
			t.Fatalf("input=%s unexpected error: %v", c.in, err)
		}
		if got != c.want || hasRef != c.hasRef {
			t.Fatalf("input=%s got %q hasRef=%v want %q hasRef=%v", c.in, got, hasRef, c.want, c.hasRef)
		}
	}
}

func TestOutboxCallKey_ReferenceDedupesAcrossEntities(t *testing.T) {
	input := []byte(`{"reference":"ref-abc","amount":500}`)
	k1, err := outboxCallKey("entity-a", "PayGateway", input)
	if err != nil {
		t.Fatal(err)
	}
	k2, err := outboxCallKey("entity-b", "PayGateway", input)
	if err != nil {
		t.Fatal(err)
	}
	if k1 != k2 {
		t.Fatalf("same reference should produce same call key: %q vs %q", k1, k2)
	}
}

func TestOutboxCallKey_NoReferenceUsesEntityAndInput(t *testing.T) {
	inputA := []byte(`{"amount":100}`)
	inputB := []byte(`{"amount":200}`)
	kSame, err := outboxCallKey("entity-1", "Notify", inputA)
	if err != nil {
		t.Fatal(err)
	}
	kSameAgain, err := outboxCallKey("entity-1", "Notify", inputA)
	if err != nil {
		t.Fatal(err)
	}
	kOtherInput, err := outboxCallKey("entity-1", "Notify", inputB)
	if err != nil {
		t.Fatal(err)
	}
	kOtherEntity, err := outboxCallKey("entity-2", "Notify", inputA)
	if err != nil {
		t.Fatal(err)
	}
	if kSame != kSameAgain {
		t.Fatal("identical entity/service/input should be deterministic")
	}
	if kSame == kOtherInput {
		t.Fatal("different input should produce different call key")
	}
	if kSame == kOtherEntity {
		t.Fatal("different entity should produce different call key")
	}
}

func TestExternalCallKey_UsesBusinessKey(t *testing.T) {
	ext := External[idemPayInput, struct{}]{
		Name: "PayGateway",
		IdempotencyKey: func(in idemPayInput) string {
			return in.Reference.Value()
		},
	}
	var ref semantic.String
	ref.Set("pay-ref-99")
	in := idemPayInput{Reference: ref}
	inputJSON := []byte(`{"reference":"pay-ref-99","amount":1000}`)
	keyA, err := ext.callKey("entity-a", in, inputJSON)
	if err != nil {
		t.Fatal(err)
	}
	keyB, err := ext.callKey("entity-b", in, inputJSON)
	if err != nil {
		t.Fatal(err)
	}
	if keyA == "" || keyA != keyB {
		t.Fatalf("expected same business call key, got %q and %q", keyA, keyB)
	}
	want := outboxBusinessCallKey("PayGateway", "pay-ref-99")
	if keyA != want {
		t.Fatalf("callKey=%q want %q", keyA, want)
	}
}

func TestExternalCallKey_EntityScopedWithoutBusinessKey(t *testing.T) {
	ext := External[idemPayInput, struct{}]{Name: "PayGateway"}
	in := idemPayInput{}
	inputJSON := []byte(`{"amount":1000}`)
	keyA, err := ext.callKey("entity-a", in, inputJSON)
	if err != nil {
		t.Fatal(err)
	}
	keyB, err := ext.callKey("entity-b", in, inputJSON)
	if err != nil {
		t.Fatal(err)
	}
	if keyA == "" || keyB == "" || keyA == keyB {
		t.Fatalf("expected distinct entity-scoped keys, got %q and %q", keyA, keyB)
	}
}

func TestExternalCallKey_EmptyBusinessKeyRejected(t *testing.T) {
	ext := External[idemPayInput, struct{}]{
		Name: "PayGateway",
		IdempotencyKey: func(in idemPayInput) string {
			return in.Reference.Value()
		},
	}
	in := idemPayInput{}
	inputJSON := []byte(`{"reference":"","amount":1000}`)
	_, err := ext.callKey("entity-a", in, inputJSON)
	if !errors.Is(err, ErrIdempotencyKeyEmpty) {
		t.Fatalf("got %v want ErrIdempotencyKeyEmpty", err)
	}
}

func TestExternalCallKey_ListContextUsesBusinessKey(t *testing.T) {
	ext := External[idemPayInput, struct{}]{
		Name: "PayGateway",
		IdempotencyKey: func(in idemPayInput) string {
			return in.Reference.Value()
		},
	}
	var ref semantic.String
	ref.Set("list-ref")
	in := idemPayInput{Reference: ref}
	inputJSON := []byte(`{"reference":"list-ref"}`)
	got, err := ext.callKey("", in, inputJSON)
	if err != nil {
		t.Fatal(err)
	}
	want := outboxBusinessCallKey("PayGateway", "list-ref")
	if got != want {
		t.Fatalf("got %q want %q", got, want)
	}
}

func TestLookupIdempotency_Missing(t *testing.T) {
	database := openTestDB(t)
	body, status, err := database.lookupIdempotency(context.Background(), "IdemOrder", "missing-key")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if body != nil || status != 0 {
		t.Fatalf("body=%v status=%d want nil,0", body, status)
	}
}

func TestIdempotencyPutGet_RoundTrip(t *testing.T) {
	database := openTestDB(t)
	ctx := context.Background()
	model := "IdemOrder"
	key := uniqueKey(t, "put-get")
	resp := map[string]any{"data": map[string]any{"id": "ent-123"}}
	if err := database.storeIdempotency(ctx, model, key, resp, 201); err != nil {
		t.Fatalf("store: %v", err)
	}
	gotBody, gotStatus, err := database.lookupIdempotency(ctx, model, key)
	if err != nil {
		t.Fatalf("lookup: %v", err)
	}
	if gotStatus != 201 {
		t.Fatalf("status=%d want 201", gotStatus)
	}
	id, _ := gotBody["data"].(map[string]any)["id"].(string)
	if id != "ent-123" {
		t.Fatalf("id=%q want ent-123", id)
	}
}

func TestIdempotencyPut_ConflictIgnored(t *testing.T) {
	database := openTestDB(t)
	ctx := context.Background()
	model := "IdemOrder"
	key := uniqueKey(t, "conflict")
	first := map[string]any{"data": map[string]any{"id": "first"}}
	second := map[string]any{"data": map[string]any{"id": "second"}}
	if err := database.storeIdempotency(ctx, model, key, first, 201); err != nil {
		t.Fatalf("first store: %v", err)
	}
	if err := database.storeIdempotency(ctx, model, key, second, 201); err != nil {
		t.Fatalf("second store: %v", err)
	}
	gotBody, _, err := database.lookupIdempotency(ctx, model, key)
	if err != nil {
		t.Fatalf("lookup: %v", err)
	}
	id, _ := gotBody["data"].(map[string]any)["id"].(string)
	if id != "first" {
		t.Fatalf("id=%q want first (conflict should keep original)", id)
	}
}

func TestCreateRunner_SameUniqueReferenceReturnsSameID(t *testing.T) {
	app, _ := setupIdempotencyApp(t)
	ref := uniqueKey(t, "create-dedupe")
	runner := app.byName["IdemOrder"].runner
	body := map[string]any{"reference": ref, "amount": int64(500)}
	first, err := runner.create(nil, body)
	if err != nil {
		t.Fatalf("first create: %v", err)
	}
	firstID, _ := first["id"].(string)
	if firstID == "" {
		t.Fatal("expected id from first create")
	}
	second, err := runner.create(nil, body)
	if err != nil {
		t.Fatalf("second create: %v", err)
	}
	secondID, _ := second["id"].(string)
	if secondID != firstID {
		t.Fatalf("second id=%q want %q", secondID, firstID)
	}
}

func TestCreateRunner_ActiveReferenceDoesNotInsertAgain(t *testing.T) {
	app, database := setupIdempotencyApp(t)
	ref := uniqueKey(t, "active-dedupe")
	entityID := newUUIDv7()
	_, err := database.pool.Exec(context.Background(),
		`INSERT INTO "IdemOrder" ("id", "reference", "amount", "_fookie_status") VALUES ($1,$2,$3,$4)`,
		entityID, ref, int64(700), entityStatusActive)
	if err != nil {
		t.Fatalf("seed active row: %v", err)
	}
	runner := app.byName["IdemOrder"].runner
	got, err := runner.create(nil, map[string]any{"reference": ref, "amount": int64(700)})
	if err != nil {
		t.Fatalf("create: %v", err)
	}
	if got["id"] != entityID {
		t.Fatalf("id=%v want %q", got["id"], entityID)
	}
	var count int
	if err := database.pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM "IdemOrder" WHERE "reference" = $1`, ref).Scan(&count); err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 1 {
		t.Fatalf("count=%d want 1 row for unique reference", count)
	}
}

func TestCreateRunner_FailedReferenceResumes(t *testing.T) {
	app, database := setupIdempotencyApp(t)
	ref := uniqueKey(t, "failed-resume")
	entityID := newUUIDv7()
	_, err := database.pool.Exec(context.Background(),
		`INSERT INTO "IdemOrder" ("id", "reference", "amount", "_fookie_status", "_fookie_error") VALUES ($1,$2,$3,$4,$5)`,
		entityID, ref, int64(900), entityStatusFailed, "boom")
	if err != nil {
		t.Fatalf("seed failed row: %v", err)
	}
	runner := app.byName["IdemOrder"].runner
	got, err := runner.create(nil, map[string]any{"reference": ref, "amount": int64(900)})
	if err != nil {
		t.Fatalf("create resume: %v", err)
	}
	if got["id"] != entityID {
		t.Fatalf("id=%v want %q", got["id"], entityID)
	}
	var status string
	if err := database.pool.QueryRow(context.Background(),
		`SELECT "_fookie_status" FROM "IdemOrder" WHERE "id" = $1`, entityID).Scan(&status); err != nil {
		t.Fatalf("status query: %v", err)
	}
	if status != entityStatusPending {
		t.Fatalf("status=%q want pending after resume kick", status)
	}
}

func TestIdempotencyDB_ModelIsolation(t *testing.T) {
	database := openTestDB(t)
	ctx := context.Background()
	key := uniqueKey(t, "model-isolation")
	if err := database.storeIdempotency(ctx, "ModelA", key, map[string]any{"data": "a"}, 201); err != nil {
		t.Fatal(err)
	}
	if err := database.storeIdempotency(ctx, "ModelB", key, map[string]any{"data": "b"}, 202); err != nil {
		t.Fatal(err)
	}
	recA, err := database.idempotencyGet(ctx, "ModelA", key)
	if err != nil {
		t.Fatal(err)
	}
	recB, err := database.idempotencyGet(ctx, "ModelB", key)
	if err != nil {
		t.Fatal(err)
	}
	if recA.StatusCode != 201 || recB.StatusCode != 202 {
		t.Fatalf("statusA=%d statusB=%d", recA.StatusCode, recB.StatusCode)
	}
}

func TestMigrateIdempotency_Idempotent(t *testing.T) {
	database := openTestDB(t)
	if err := database.migrateIdempotency(); err != nil {
		t.Fatalf("first migrate: %v", err)
	}
	if err := database.migrateIdempotency(); err != nil {
		t.Fatalf("second migrate: %v", err)
	}
}

func openTestDB(t *testing.T) *db {
	t.Helper()
	dsn := os.Getenv("DB_URL")
	if dsn == "" {
		dsn = "postgres://fookie:fookie_dev@localhost:5432/fookie?sslmode=disable"
	}
	database, err := openDB(dsn)
	if err != nil {
		t.Skipf("postgres unavailable: %v", err)
	}
	if err := database.migrateIdempotency(); err != nil {
		database.pool.Close()
		t.Fatalf("migrate idempotency: %v", err)
	}
	t.Cleanup(func() { database.pool.Close() })
	return database
}

func setupIdempotencyApp(t *testing.T) (*App, *db) {
	t.Helper()
	database := openTestDB(t)
	app := New(nil)
	Register(app, &Model[idemOrderFields]{
		Name: "IdemOrder",
		Operations: Operations[idemOrderFields]{
			Create: func(ctx *Flow[idemOrderFields]) {
				ctx.Body.Amount.Set(ctx.Body.Amount.Value())
			},
		},
	})
	if err := database.migrate(app.models); err != nil {
		t.Fatalf("migrate model: %v", err)
	}
	if err := database.migrateIdempotency(); err != nil {
		t.Fatalf("migrate idempotency: %v", err)
	}
	app.db = database
	t.Cleanup(func() {
		_, _ = database.pool.Exec(context.Background(), `DELETE FROM "IdemOrder"`)
		_, _ = database.pool.Exec(context.Background(), `DELETE FROM fookie_idempotency WHERE model = 'IdemOrder'`)
	})
	return app, database
}

type idemOrderFields struct {
	Reference semantic.String `fookie:"unique"`
	Amount    semantic.Currency
}

func uniqueKey(t *testing.T, prefix string) string {
	t.Helper()
	return fmt.Sprintf("%s-%d", prefix, time.Now().UnixNano())
}

func waitForEntityStatus(t *testing.T, database *db, model, entityID, want string) {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		var status string
		err := database.pool.QueryRow(context.Background(),
			fmt.Sprintf(`SELECT "_fookie_status" FROM "%s" WHERE "id" = $1`, model), entityID).Scan(&status)
		if err == nil && status == want {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatalf("entity %s did not reach status %q", entityID, want)
}

func TestCreateRunner_PendingReferenceReturnsSameID(t *testing.T) {
	app, database := setupIdempotencyApp(t)
	ref := uniqueKey(t, "pending-dedupe")
	runner := app.byName["IdemOrder"].runner
	body := map[string]any{"reference": ref, "amount": int64(300)}
	first, err := runner.create(nil, body)
	if err != nil {
		t.Fatalf("first create: %v", err)
	}
	firstID, _ := first["id"].(string)
	second, err := runner.create(nil, body)
	if err != nil {
		t.Fatalf("second create: %v", err)
	}
	secondID, _ := second["id"].(string)
	if secondID != firstID {
		t.Fatalf("pending dedupe id=%q want %q", secondID, firstID)
	}
	var count int
	if err := database.pool.QueryRow(context.Background(),
		`SELECT COUNT(*) FROM "IdemOrder" WHERE "reference" = $1`, ref).Scan(&count); err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 1 {
		t.Fatalf("count=%d want 1", count)
	}
	waitForEntityStatus(t, database, "IdemOrder", firstID, entityStatusActive)
}

func TestIdempotencyGet_NonObjectJSONReturnsError(t *testing.T) {
	database := openTestDB(t)
	ctx := context.Background()
	model := "IdemOrder"
	key := uniqueKey(t, "bad-json")
	_, err := database.pool.Exec(ctx,
		`INSERT INTO fookie_idempotency (idempotency_key, model, response, status_code) VALUES ($1,$2,$3,$4)`,
		key, model, `"not-an-object"`, 201)
	if err != nil {
		t.Fatalf("seed: %v", err)
	}
	t.Cleanup(func() {
		_, _ = database.pool.Exec(ctx, `DELETE FROM fookie_idempotency WHERE idempotency_key = $1`, key)
	})
	_, err = database.idempotencyGet(ctx, model, key)
	if err == nil {
		t.Fatal("expected unmarshal error for non-object JSON")
	}
}
