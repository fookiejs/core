package serde

import (
	"testing"

	"github.com/fookiejs/fookie/internal/persistence/row"
	"github.com/fookiejs/fookie/semantic"
)

type serdeSchema struct {
	Name    semantic.String
	Balance semantic.Currency
	Active  semantic.Bool
}

type serdeBase struct {
	ID semantic.ID
}

type serdeEmbedSchema struct {
	serdeBase
	Amount semantic.Currency
}

type serdeFullBase struct {
	semantic.Base
	Name semantic.String
}

func TestToSnake(t *testing.T) {
	cases := []struct {
		in  string
		out string
	}{
		{"ID", "id"},
		{"Name", "name"},
		{"FirstName", "first_name"},
		{"UserID", "user_id"},
		{"HTMLBody", "html_body"},
		{"createdAt", "created_at"},
		{"amount", "amount"},
		{"AccountBalance", "account_balance"},
	}
	for _, c := range cases {
		got := ToSnake(c.in)
		if got != c.out {
			t.Errorf("ToSnake(%q) = %q, want %q", c.in, got, c.out)
		}
	}
}

func TestValues_SimpleValues(t *testing.T) {
	s := serdeSchema{}
	s.Name.Set("alice")
	s.Balance.Set(1000)
	s.Active.Set(true)

	m := Values(s)
	assertRowString(t, m, "name", "alice")
	assertRowInt64(t, m, "balance", 1000)
	assertRowBool(t, m, "active", true)
}

func TestValues_ZeroValues(t *testing.T) {
	m := Values(serdeSchema{})
	assertRowString(t, m, "name", "")
	assertRowInt64(t, m, "balance", 0)
	assertRowBool(t, m, "active", false)
}

func TestValues_OverwrittenValue(t *testing.T) {
	s := serdeSchema{}
	s.Name.Set("bob")
	s.Name.Set("charlie")
	m := Values(s)
	assertRowString(t, m, "name", "charlie")
}

func TestValues_EmbeddedBase(t *testing.T) {
	s := serdeEmbedSchema{}
	s.ID.Set("test-id-1")
	s.Amount.Set(5000)
	m := Values(s)
	assertRowString(t, m, "id", "test-id-1")
	assertRowInt64(t, m, "amount", 5000)
}

func TestValues_OmitsProtectedBaseFields(t *testing.T) {
	s := serdeFullBase{}
	s.ID.Set("id-1")
	s.CreatedAt.Set("2024-01-01T00:00:00Z")
	s.UpdatedAt.Set("2024-01-02T00:00:00Z")
	s.IsDeleted.Set(true)
	s.Name.Set("alice")
	m := Values(s)
	assertRowString(t, m, "id", "id-1")
	assertRowString(t, m, "name", "alice")
	if _, ok := m.Find("created_at"); ok {
		t.Fatal("created_at should be omitted")
	}
	if _, ok := m.Find("updated_at"); ok {
		t.Fatal("updated_at should be omitted")
	}
	if _, ok := m.Find("is_deleted"); ok {
		t.Fatal("is_deleted should be omitted")
	}
}

func TestFilterInputRow(t *testing.T) {
	m := row.Values{
		{Column: "name", Cell: row.FromText("bob")},
		{Column: "created_at", Cell: row.FromText("2024-01-01T00:00:00Z")},
		{Column: "updated_at", Cell: row.FromText("2024-01-02T00:00:00Z")},
		{Column: "is_deleted", Cell: row.FromTruth(true)},
	}
	out := FilterInputRow(m)
	assertRowString(t, out, "name", "bob")
	if len(out) != 1 {
		t.Fatalf("expected 1 key, got %d", len(out))
	}
}

func TestIntoStruct_SimpleValues(t *testing.T) {
	m := row.Values{
		{Column: "name", Cell: row.FromText("dave")},
		{Column: "balance", Cell: row.FromInteger(2500)},
		{Column: "active", Cell: row.FromTruth(true)},
	}
	var s serdeSchema
	IntoStruct(m, &s)
	if s.Name.Value() != "dave" {
		t.Errorf("expected name=dave, got %q", s.Name.Value())
	}
	if s.Balance.Value() != 2500 {
		t.Errorf("expected balance=2500, got %d", s.Balance.Value())
	}
	if !s.Active.Value() {
		t.Error("expected active=true")
	}
}

func TestIntoStruct_Partial(t *testing.T) {
	m := row.Values{{Column: "name", Cell: row.FromText("eve")}}
	var s serdeSchema
	IntoStruct(m, &s)
	if s.Name.Value() != "eve" {
		t.Errorf("expected name=eve, got %q", s.Name.Value())
	}
	if s.Balance.Value() != 0 {
		t.Errorf("expected balance=0, got %d", s.Balance.Value())
	}
}

func TestIntoStruct_Nil(t *testing.T) {
	var s serdeSchema
	IntoStruct(nil, &s)
	if s.Name.Value() != "" {
		t.Error("expected zero value after nil values")
	}
}

func TestIntoStruct_NilSchema(t *testing.T) {
	m := row.Values{{Column: "name", Cell: row.FromText("frank")}}
	var s *serdeSchema
	IntoStruct(m, s)
}

func TestIntoStruct_UnknownKeys(t *testing.T) {
	m := row.Values{
		{Column: "name", Cell: row.FromText("grace")},
		{Column: "unknown", Cell: row.FromText("ignored")},
		{Column: "also", Cell: row.FromInteger(99)},
	}
	var s serdeSchema
	IntoStruct(m, &s)
	if s.Name.Value() != "grace" {
		t.Errorf("expected name=grace, got %q", s.Name.Value())
	}
}

func TestIntoStruct_EmptyValue(t *testing.T) {
	m := row.Values{
		{Column: "name", Cell: row.EmptyCell()},
		{Column: "balance", Cell: row.FromInteger(50)},
	}
	var s serdeSchema
	IntoStruct(m, &s)
	if s.Name.Value() != "" {
		t.Errorf("expected name to remain empty, got %q", s.Name.Value())
	}
	if s.Balance.Value() != 50 {
		t.Errorf("expected balance=50, got %d", s.Balance.Value())
	}
}

func TestIntoStruct_EmbeddedBase(t *testing.T) {
	m := row.Values{
		{Column: "id", Cell: row.FromText("embed-id-42")},
		{Column: "amount", Cell: row.FromInteger(9999)},
	}
	var s serdeEmbedSchema
	IntoStruct(m, &s)
	if s.ID.Value() != "embed-id-42" {
		t.Errorf("expected id=embed-id-42, got %q", s.ID.Value())
	}
	if s.Amount.Value() != 9999 {
		t.Errorf("expected amount=9999, got %d", s.Amount.Value())
	}
}

func TestRoundTrip(t *testing.T) {
	orig := serdeSchema{}
	orig.Name.Set("helen")
	orig.Balance.Set(7777)
	orig.Active.Set(true)

	m := Values(orig)
	var restored serdeSchema
	IntoStruct(m, &restored)

	if restored.Name.Value() != "helen" {
		t.Errorf("roundtrip: name mismatch: got %q", restored.Name.Value())
	}
	if restored.Balance.Value() != 7777 {
		t.Errorf("roundtrip: balance mismatch: got %d", restored.Balance.Value())
	}
	if !restored.Active.Value() {
		t.Error("roundtrip: active mismatch")
	}
}

func assertRowString(t *testing.T, m row.Values, key, want string) {
	t.Helper()
	c, ok := m.Find(key)
	if !ok {
		t.Errorf("key %q not in values", key)
		return
	}
	if c.Kind != row.KindText || c.Text != want {
		t.Errorf("key %q: expected text %q, got %+v", key, want, c)
	}
}

func assertRowInt64(t *testing.T, m row.Values, key string, want int64) {
	t.Helper()
	c, ok := m.Find(key)
	if !ok {
		t.Errorf("key %q not in values", key)
		return
	}
	if c.Kind != row.KindInteger || c.Integer != want {
		t.Errorf("key %q: expected integer %d, got %+v", key, want, c)
	}
}

func assertRowBool(t *testing.T, m row.Values, key string, want bool) {
	t.Helper()
	c, ok := m.Find(key)
	if !ok {
		t.Errorf("key %q not in values", key)
		return
	}
	if c.Kind != row.KindTruth || c.Truth != want {
		t.Errorf("key %q: expected truth %v, got %+v", key, want, c)
	}
}
