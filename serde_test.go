package fookie

import (
	"testing"

	"github.com/fookiejs/fookie/semantic"
)

type serdeSchema struct {
	Name    semantic.String
	Balance semantic.Currency
	Active  semantic.Bool
}

func TestSchemaToMap_SimpleValues(t *testing.T) {
	s := serdeSchema{}
	s.Name.Set("alice")
	s.Balance.Set(1000)
	s.Active.Set(true)

	m := schemaToMap(s)
	assertMapString(t, m, "name", "alice")
	assertMapInt64(t, m, "balance", 1000)
	assertMapBool(t, m, "active", true)
}

func TestSchemaToMap_ZeroValues(t *testing.T) {
	m := schemaToMap(serdeSchema{})
	assertMapString(t, m, "name", "")
	assertMapInt64(t, m, "balance", 0)
	assertMapBool(t, m, "active", false)
}

func TestSchemaToMap_OverwrittenValue(t *testing.T) {
	s := serdeSchema{}
	s.Name.Set("bob")
	s.Name.Set("charlie")
	m := schemaToMap(s)
	assertMapString(t, m, "name", "charlie")
}

type serdeEmbedSchema struct {
	Base
	Amount semantic.Currency
}

func TestSchemaToMap_EmbeddedBase(t *testing.T) {
	s := serdeEmbedSchema{}
	s.ID.Set("test-id-1")
	s.Amount.Set(5000)
	m := schemaToMap(s)
	assertMapString(t, m, "id", "test-id-1")
	assertMapInt64(t, m, "amount", 5000)
}

func TestMapToSchema_SimpleValues(t *testing.T) {
	m := map[string]any{
		"name":    "dave",
		"balance": int64(2500),
		"active":  true,
	}
	var s serdeSchema
	mapToSchema(m, &s)
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

func TestMapToSchema_PartialMap(t *testing.T) {
	m := map[string]any{"name": "eve"}
	var s serdeSchema
	mapToSchema(m, &s)
	if s.Name.Value() != "eve" {
		t.Errorf("expected name=eve, got %q", s.Name.Value())
	}
	if s.Balance.Value() != 0 {
		t.Errorf("expected balance=0, got %d", s.Balance.Value())
	}
}

func TestMapToSchema_NilMap(t *testing.T) {
	var s serdeSchema
	mapToSchema(nil, &s)
	if s.Name.Value() != "" {
		t.Error("expected zero value after nil map")
	}
}

func TestMapToSchema_NilSchema(t *testing.T) {
	m := map[string]any{"name": "frank"}
	var s *serdeSchema
	mapToSchema(m, s)
}

func TestMapToSchema_UnknownKeys(t *testing.T) {
	m := map[string]any{
		"name":    "grace",
		"unknown": "ignored",
		"also":    99,
	}
	var s serdeSchema
	mapToSchema(m, &s)
	if s.Name.Value() != "grace" {
		t.Errorf("expected name=grace, got %q", s.Name.Value())
	}
}

func TestMapToSchema_NilValue(t *testing.T) {
	m := map[string]any{"name": nil, "balance": int64(50)}
	var s serdeSchema
	mapToSchema(m, &s)
	if s.Name.Value() != "" {
		t.Errorf("expected name to remain empty, got %q", s.Name.Value())
	}
	if s.Balance.Value() != 50 {
		t.Errorf("expected balance=50, got %d", s.Balance.Value())
	}
}

func TestMapToSchema_EmbeddedBase(t *testing.T) {
	m := map[string]any{
		"id":     "embed-id-42",
		"amount": int64(9999),
	}
	var s serdeEmbedSchema
	mapToSchema(m, &s)
	if s.ID.Value() != "embed-id-42" {
		t.Errorf("expected id=embed-id-42, got %q", s.ID.Value())
	}
	if s.Amount.Value() != 9999 {
		t.Errorf("expected amount=9999, got %d", s.Amount.Value())
	}
}

func TestSchemaToMapAndBack_RoundTrip(t *testing.T) {
	orig := serdeSchema{}
	orig.Name.Set("helen")
	orig.Balance.Set(7777)
	orig.Active.Set(true)

	m := schemaToMap(orig)
	var restored serdeSchema
	mapToSchema(m, &restored)

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

func TestSchemaToMap_ConvertibleInt(t *testing.T) {
	m := map[string]any{"balance": int32(123)}
	var s serdeSchema
	mapToSchema(m, &s)
	if s.Balance.Value() != 123 {
		t.Errorf("expected convertible int32→int64 to work, got %d", s.Balance.Value())
	}
}

func assertMapString(t *testing.T, m map[string]any, key, want string) {
	t.Helper()
	v, ok := m[key]
	if !ok {
		t.Errorf("key %q not in map", key)
		return
	}
	got, ok := v.(string)
	if !ok {
		t.Errorf("key %q: expected string, got %T", key, v)
		return
	}
	if got != want {
		t.Errorf("key %q: expected %q, got %q", key, want, got)
	}
}

func assertMapInt64(t *testing.T, m map[string]any, key string, want int64) {
	t.Helper()
	v, ok := m[key]
	if !ok {
		t.Errorf("key %q not in map", key)
		return
	}
	got, ok := v.(int64)
	if !ok {
		t.Errorf("key %q: expected int64, got %T", key, v)
		return
	}
	if got != want {
		t.Errorf("key %q: expected %d, got %d", key, want, got)
	}
}

func assertMapBool(t *testing.T, m map[string]any, key string, want bool) {
	t.Helper()
	v, ok := m[key]
	if !ok {
		t.Errorf("key %q not in map", key)
		return
	}
	got, ok := v.(bool)
	if !ok {
		t.Errorf("key %q: expected bool, got %T", key, v)
		return
	}
	if got != want {
		t.Errorf("key %q: expected %v, got %v", key, want, got)
	}
}
