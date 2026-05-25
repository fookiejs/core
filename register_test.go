package fookie

import (
	"testing"

	"github.com/fookiejs/fookie/semantic"
)

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
		got := toSnake(c.in)
		if got != c.out {
			t.Errorf("toSnake(%q) = %q, want %q", c.in, got, c.out)
		}
	}
}

func TestApplyTag_Indexed(t *testing.T) {
	def := &FieldDef{}
	applyTag(def, "indexed")
	if !def.Indexed {
		t.Fatal("expected Indexed=true")
	}
}

func TestApplyTag_Unique(t *testing.T) {
	def := &FieldDef{}
	applyTag(def, "unique")
	if !def.Unique {
		t.Fatal("expected Unique=true")
	}
}

func TestApplyTag_Relation(t *testing.T) {
	def := &FieldDef{}
	applyTag(def, "relation:Account")
	if def.RelationName != "Account" {
		t.Fatalf("expected RelationName=Account, got %q", def.RelationName)
	}
}

func TestApplyTag_Min(t *testing.T) {
	def := &FieldDef{}
	applyTag(def, "min=0")
	if def.Min == nil || *def.Min != 0 {
		t.Fatalf("expected Min=0, got %v", def.Min)
	}
}

func TestApplyTag_Max(t *testing.T) {
	def := &FieldDef{}
	applyTag(def, "max=1000000")
	if def.Max == nil || *def.Max != 1000000 {
		t.Fatalf("expected Max=1000000, got %v", def.Max)
	}
}

func TestApplyTag_Combined(t *testing.T) {
	def := &FieldDef{}
	applyTag(def, "unique,indexed,relation:Order,min=1,max=500")
	if !def.Unique {
		t.Error("expected Unique=true")
	}
	if !def.Indexed {
		t.Error("expected Indexed=true")
	}
	if def.RelationName != "Order" {
		t.Errorf("expected RelationName=Order, got %q", def.RelationName)
	}
	if def.Min == nil || *def.Min != 1 {
		t.Errorf("expected Min=1, got %v", def.Min)
	}
	if def.Max == nil || *def.Max != 500 {
		t.Errorf("expected Max=500, got %v", def.Max)
	}
}

func TestApplyTag_Empty(t *testing.T) {
	def := &FieldDef{}
	applyTag(def, "")
	if def.Indexed || def.Unique || def.RelationName != "" {
		t.Fatal("expected zero def for empty tag")
	}
}

func TestApplyTag_InvalidMin(t *testing.T) {
	def := &FieldDef{}
	applyTag(def, "min=notanumber")
	if def.Min != nil {
		t.Fatal("expected Min=nil for invalid value")
	}
}

type simpleSchema struct {
	Name    semantic.String
	Balance semantic.Currency `fookie:"min=0"`
	Active  semantic.Bool     `fookie:"indexed"`
}

func TestFieldsFromSchema_Simple(t *testing.T) {
	fields := fieldsFromSchema(simpleSchema{})
	if len(fields) != 3 {
		t.Fatalf("expected 3 fields, got %d", len(fields))
	}
	assertField(t, fields, "name", stringKind, false, false, nil, nil)
	assertField(t, fields, "balance", currencyKind, false, false, int64ptr(0), nil)
	assertField(t, fields, "active", boolKind, true, false, nil, nil)
}

type embeddedSchema struct {
	Base
	Amount semantic.Currency
}

func TestFieldsFromSchema_EmbeddedBase(t *testing.T) {
	fields := fieldsFromSchema(embeddedSchema{})
	names := make(map[string]kind)
	for _, f := range fields {
		names[f.Name] = f.Kind
	}
	if k, ok := names["id"]; !ok || k != idKind {
		t.Error("expected embedded Base.ID to be flattened as 'id' with idKind")
	}
	if k, ok := names["amount"]; !ok || k != currencyKind {
		t.Error("expected Amount field with currencyKind")
	}
}

type deepEmbedInner struct {
	Email semantic.Email `fookie:"unique"`
}

type deepEmbedOuter struct {
	deepEmbedInner
	Name semantic.String
}

func TestFieldsFromSchema_DeepEmbed(t *testing.T) {
	fields := fieldsFromSchema(deepEmbedOuter{})
	names := make(map[string]FieldDef)
	for _, f := range fields {
		names[f.Name] = f
	}
	emailDef, ok := names["email"]
	if !ok {
		t.Fatal("expected 'email' field from deep embedded struct")
	}
	if !emailDef.Unique {
		t.Error("expected Unique=true on embedded Email field")
	}
	if _, ok := names["name"]; !ok {
		t.Error("expected 'name' field")
	}
}

func TestFieldsFromSchema_IgnoresNonSemantic(t *testing.T) {
	type withNonSemantic struct {
		Name   semantic.String
		Hidden string
		Count  int
	}
	fields := fieldsFromSchema(withNonSemantic{})
	if len(fields) != 1 {
		t.Fatalf("expected 1 field (only semantic), got %d", len(fields))
	}
	if fields[0].Name != "name" {
		t.Fatalf("expected name, got %q", fields[0].Name)
	}
}

func TestFieldsFromSchema_AllKinds(t *testing.T) {
	type allKinds struct {
		S   semantic.String
		I   semantic.Int
		F   semantic.Float
		B   semantic.Bool
		ID  semantic.ID
		Cur semantic.Currency
		Em  semantic.Email
		J   semantic.JSON
		En  semantic.Enum
		Ts  semantic.Timestamp
		D   semantic.Date
		U   semantic.URL
		Ph  semantic.Phone
		Uu  semantic.UUID
		Co  semantic.Color
		Lo  semantic.Locale
		Ib  semantic.IBAN
		Ip  semantic.IP
		Cd  semantic.Coordinate
	}
	fields := fieldsFromSchema(allKinds{})
	if len(fields) != 19 {
		t.Fatalf("expected 19 fields, got %d", len(fields))
	}
}

func TestEnsureDefaultID_AddsWhenMissing(t *testing.T) {
	in := []FieldDef{{Name: "name", Kind: stringKind}}
	out := ensureDefaultID(in)
	if len(out) != 2 {
		t.Fatalf("expected 2 fields, got %d", len(out))
	}
	if out[0].Name != "id" || out[0].Kind != idKind {
		t.Errorf("expected id field first, got %+v", out[0])
	}
}

func TestEnsureDefaultID_SkipsWhenPresent(t *testing.T) {
	in := []FieldDef{{Name: "id", Kind: idKind}, {Name: "name", Kind: stringKind}}
	out := ensureDefaultID(in)
	if len(out) != 2 {
		t.Fatalf("expected 2 fields unchanged, got %d", len(out))
	}
}

func assertField(t *testing.T, fields []FieldDef, name string, k kind, indexed, unique bool, min, max *int64) {
	t.Helper()
	for _, f := range fields {
		if f.Name != name {
			continue
		}
		if f.Kind != k {
			t.Errorf("field %q: expected kind %q, got %q", name, k, f.Kind)
		}
		if f.Indexed != indexed {
			t.Errorf("field %q: expected Indexed=%v, got %v", name, indexed, f.Indexed)
		}
		if f.Unique != unique {
			t.Errorf("field %q: expected Unique=%v, got %v", name, unique, f.Unique)
		}
		if min == nil && f.Min != nil {
			t.Errorf("field %q: expected Min=nil, got %v", name, *f.Min)
		}
		if min != nil && (f.Min == nil || *f.Min != *min) {
			t.Errorf("field %q: expected Min=%v, got %v", name, *min, f.Min)
		}
		if max == nil && f.Max != nil {
			t.Errorf("field %q: expected Max=nil, got %v", name, *f.Max)
		}
		if max != nil && (f.Max == nil || *f.Max != *max) {
			t.Errorf("field %q: expected Max=%v, got %v", name, *max, f.Max)
		}
		return
	}
	t.Errorf("field %q not found in %+v", name, fields)
}

func int64ptr(v int64) *int64 { return &v }
