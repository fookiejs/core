package fookie

import (
	"testing"

	"github.com/fookiejs/fookie/semantic"
)

type filterSchema struct {
	Name    semantic.String
	Balance semantic.Currency
	Active  semantic.Bool
}

func TestAttachFilter_SetsCallbacksForEachField(t *testing.T) {
	qb := &queryBuilder{}
	var s filterSchema
	attached := attachFilter(s, qb)

	attached.Name.Eq("alice")
	attached.Balance.Gt(500)
	attached.Active.Eq(true)

	if len(qb.filters) != 3 {
		t.Fatalf("expected 3 filters, got %d", len(qb.filters))
	}
	assertQueryFilter(t, qb.filters[0], "name", "=", "alice")
	assertQueryFilter(t, qb.filters[1], "balance", ">", int64(500))
	assertQueryFilter(t, qb.filters[2], "active", "=", true)
}

func TestAttachFilter_MultipleOpsOnSameField(t *testing.T) {
	qb := &queryBuilder{}
	var s filterSchema
	attached := attachFilter(s, qb)

	attached.Balance.Gte(100)
	attached.Balance.Lte(1000)

	if len(qb.filters) != 2 {
		t.Fatalf("expected 2 filters, got %d", len(qb.filters))
	}
	assertQueryFilter(t, qb.filters[0], "balance", ">=", int64(100))
	assertQueryFilter(t, qb.filters[1], "balance", "<=", int64(1000))
}

func TestAttachFilter_OriginalUnchanged(t *testing.T) {
	qb := &queryBuilder{}
	orig := filterSchema{}
	_ = attachFilter(orig, qb)
	orig.Name.Eq("should not fire")
	if len(qb.filters) != 0 {
		t.Fatal("original schema should have nil filter fn; calling Eq should be no-op")
	}
}

func TestAttachFilter_EmptyFilters(t *testing.T) {
	qb := &queryBuilder{}
	var s filterSchema
	_ = attachFilter(s, qb)
	if len(qb.filters) != 0 {
		t.Fatal("no filter methods called, qb should be empty")
	}
}

type filterEmbedSchema struct {
	Base
	Amount semantic.Currency
}

func TestAttachFilter_EmbeddedBase(t *testing.T) {
	qb := &queryBuilder{}
	var s filterEmbedSchema
	attached := attachFilter(s, qb)

	attached.ID.Eq("id-123")
	attached.Amount.Lte(9999)

	if len(qb.filters) != 2 {
		t.Fatalf("expected 2 filters, got %d", len(qb.filters))
	}
	assertQueryFilter(t, qb.filters[0], "id", "=", "id-123")
	assertQueryFilter(t, qb.filters[1], "amount", "<=", int64(9999))
}

func TestAttachFilter_IndependentQueryBuilders(t *testing.T) {
	qb1 := &queryBuilder{}
	qb2 := &queryBuilder{}
	var s1, s2 filterSchema

	a1 := attachFilter(s1, qb1)
	a2 := attachFilter(s2, qb2)

	a1.Name.Eq("qb1-name")
	a2.Name.Eq("qb2-name")

	if len(qb1.filters) != 1 || len(qb2.filters) != 1 {
		t.Fatal("each qb should have exactly 1 filter")
	}
	assertQueryFilter(t, qb1.filters[0], "name", "=", "qb1-name")
	assertQueryFilter(t, qb2.filters[0], "name", "=", "qb2-name")
}

func TestAttachFieldKeys_SetsKeyWithNilFn(t *testing.T) {
	s := attachFieldKeys[filterSchema]()

	if s.Name.OrderKey() != "name" {
		t.Errorf("expected OrderKey=name, got %q", s.Name.OrderKey())
	}
	if s.Balance.OrderKey() != "balance" {
		t.Errorf("expected OrderKey=balance, got %q", s.Balance.OrderKey())
	}
	s.Name.Eq("no-panic")
	s.Balance.Gte(0)
}

func TestAttachFieldKeys_EmbeddedBase(t *testing.T) {
	s := attachFieldKeys[filterEmbedSchema]()
	if s.ID.OrderKey() != "id" {
		t.Errorf("expected ID OrderKey=id, got %q", s.ID.OrderKey())
	}
	if s.Amount.OrderKey() != "amount" {
		t.Errorf("expected Amount OrderKey=amount, got %q", s.Amount.OrderKey())
	}
}

func TestQueryBuilder_Add(t *testing.T) {
	qb := &queryBuilder{}
	qb.add("name", "=", "test")
	qb.add("balance", ">", int64(100))

	if len(qb.filters) != 2 {
		t.Fatalf("expected 2, got %d", len(qb.filters))
	}
	assertQueryFilter(t, qb.filters[0], "name", "=", "test")
	assertQueryFilter(t, qb.filters[1], "balance", ">", int64(100))
}

func TestQueryBuilder_Empty(t *testing.T) {
	qb := &queryBuilder{}
	if len(qb.filters) != 0 {
		t.Fatal("new qb should have no filters")
	}
	if len(qb.orders) != 0 {
		t.Fatal("new qb should have no orders")
	}
}

func TestAttachFilter_InOperator(t *testing.T) {
	qb := &queryBuilder{}
	var s filterSchema
	attached := attachFilter(s, qb)

	attached.Name.In("a", "b", "c")

	if len(qb.filters) != 1 {
		t.Fatalf("expected 1 filter, got %d", len(qb.filters))
	}
	if qb.filters[0].op != "IN" {
		t.Errorf("expected op=IN, got %q", qb.filters[0].op)
	}
	vals, ok := qb.filters[0].value.([]string)
	if !ok {
		t.Fatalf("expected []string value, got %T", qb.filters[0].value)
	}
	if len(vals) != 3 || vals[0] != "a" || vals[1] != "b" || vals[2] != "c" {
		t.Errorf("unexpected IN values: %v", vals)
	}
}

func TestAttachFilter_NotEqOperator(t *testing.T) {
	qb := &queryBuilder{}
	var s filterSchema
	attached := attachFilter(s, qb)

	attached.Name.NotEq("excluded")

	if len(qb.filters) != 1 {
		t.Fatalf("expected 1 filter, got %d", len(qb.filters))
	}
	assertQueryFilter(t, qb.filters[0], "name", "!=", "excluded")
}

func assertQueryFilter(t *testing.T, f queryFilter, field, op string, value any) {
	t.Helper()
	if f.field != field {
		t.Errorf("filter.field: expected %q, got %q", field, f.field)
	}
	if f.op != op {
		t.Errorf("filter.op: expected %q, got %q", op, f.op)
	}
	if f.value != value {
		t.Errorf("filter.value: expected %v (%T), got %v (%T)", value, value, f.value, f.value)
	}
}
