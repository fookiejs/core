package fookie

import (
	"testing"
)

func int64p(v int64) *int64 { return &v }

func TestValidateRow_NoConstraints(t *testing.T) {
	fields := []FieldDef{{Name: "name", Kind: stringKind}}
	row := map[string]any{"name": "alice"}
	if err := validateRow(fields, row); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
}

func TestValidateRow_MinPass(t *testing.T) {
	fields := []FieldDef{{Name: "amount", Kind: currencyKind, Min: int64p(0)}}
	row := map[string]any{"amount": int64(100)}
	if err := validateRow(fields, row); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
}

func TestValidateRow_MinZeroPass(t *testing.T) {
	fields := []FieldDef{{Name: "amount", Kind: currencyKind, Min: int64p(0)}}
	row := map[string]any{"amount": int64(0)}
	if err := validateRow(fields, row); err != nil {
		t.Fatalf("expected nil for value==min, got %v", err)
	}
}

func TestValidateRow_MinFail(t *testing.T) {
	fields := []FieldDef{{Name: "amount", Kind: currencyKind, Min: int64p(0)}}
	row := map[string]any{"amount": int64(-1)}
	err := validateRow(fields, row)
	if err == nil {
		t.Fatal("expected validation_error, got nil")
	}
	if err.Code != "validation_error" {
		t.Errorf("expected code=validation_error, got %q", err.Code)
	}
}

func TestValidateRow_MaxPass(t *testing.T) {
	fields := []FieldDef{{Name: "score", Kind: int64Kind, Max: int64p(100)}}
	row := map[string]any{"score": int64(100)}
	if err := validateRow(fields, row); err != nil {
		t.Fatalf("expected nil for value==max, got %v", err)
	}
}

func TestValidateRow_MaxFail(t *testing.T) {
	fields := []FieldDef{{Name: "score", Kind: int64Kind, Max: int64p(100)}}
	row := map[string]any{"score": int64(101)}
	err := validateRow(fields, row)
	if err == nil {
		t.Fatal("expected validation_error, got nil")
	}
	if err.Code != "validation_error" {
		t.Errorf("expected code=validation_error, got %q", err.Code)
	}
}

func TestValidateRow_MinMaxBothPass(t *testing.T) {
	fields := []FieldDef{{Name: "pct", Kind: int64Kind, Min: int64p(0), Max: int64p(100)}}
	row := map[string]any{"pct": int64(50)}
	if err := validateRow(fields, row); err != nil {
		t.Fatalf("expected nil, got %v", err)
	}
}

func TestValidateRow_MinMaxBothFail_BelowMin(t *testing.T) {
	fields := []FieldDef{{Name: "pct", Kind: int64Kind, Min: int64p(0), Max: int64p(100)}}
	row := map[string]any{"pct": int64(-5)}
	if err := validateRow(fields, row); err == nil {
		t.Fatal("expected validation_error")
	}
}

func TestValidateRow_MinMaxBothFail_AboveMax(t *testing.T) {
	fields := []FieldDef{{Name: "pct", Kind: int64Kind, Min: int64p(0), Max: int64p(100)}}
	row := map[string]any{"pct": int64(150)}
	if err := validateRow(fields, row); err == nil {
		t.Fatal("expected validation_error")
	}
}

func TestValidateRow_MissingKey_Skipped(t *testing.T) {
	fields := []FieldDef{{Name: "amount", Kind: currencyKind, Min: int64p(0)}}
	row := map[string]any{}
	if err := validateRow(fields, row); err != nil {
		t.Fatalf("missing key should be skipped, got %v", err)
	}
}

func TestValidateRow_NilValue_Skipped(t *testing.T) {
	fields := []FieldDef{{Name: "amount", Kind: currencyKind, Min: int64p(0)}}
	row := map[string]any{"amount": nil}
	if err := validateRow(fields, row); err != nil {
		t.Fatalf("nil value should be skipped, got %v", err)
	}
}

func TestValidateRow_StringField_Skipped(t *testing.T) {
	fields := []FieldDef{{Name: "name", Kind: stringKind, Min: int64p(0)}}
	row := map[string]any{"name": "alice"}
	if err := validateRow(fields, row); err != nil {
		t.Fatalf("string field with min should be skipped (not convertible), got %v", err)
	}
}

func TestValidateRow_Float64Value(t *testing.T) {
	fields := []FieldDef{{Name: "rate", Kind: float64Kind, Min: int64p(0), Max: int64p(100)}}
	row := map[string]any{"rate": float64(50.7)}
	if err := validateRow(fields, row); err != nil {
		t.Fatalf("float64 should be convertible to int64, got %v", err)
	}
}

func TestValidateRow_Float64_ExceedsMax(t *testing.T) {
	fields := []FieldDef{{Name: "rate", Kind: float64Kind, Max: int64p(100)}}
	row := map[string]any{"rate": float64(200.0)}
	if err := validateRow(fields, row); err == nil {
		t.Fatal("expected validation_error for float64 exceeding max")
	}
}

func TestValidateRow_MultipleFields_FirstFails(t *testing.T) {
	fields := []FieldDef{
		{Name: "a", Kind: int64Kind, Min: int64p(0)},
		{Name: "b", Kind: int64Kind, Min: int64p(0)},
	}
	row := map[string]any{"a": int64(-1), "b": int64(5)}
	err := validateRow(fields, row)
	if err == nil {
		t.Fatal("expected validation_error")
	}
}

func TestToInt64_Int64(t *testing.T) {
	v, ok := toInt64(int64(42))
	if !ok || v != 42 {
		t.Errorf("expected (42, true), got (%d, %v)", v, ok)
	}
}

func TestToInt64_Int32(t *testing.T) {
	v, ok := toInt64(int32(99))
	if !ok || v != 99 {
		t.Errorf("expected (99, true), got (%d, %v)", v, ok)
	}
}

func TestToInt64_Float64(t *testing.T) {
	v, ok := toInt64(float64(3.9))
	if !ok || v != 3 {
		t.Errorf("expected (3, true), got (%d, %v)", v, ok)
	}
}

func TestToInt64_String_False(t *testing.T) {
	_, ok := toInt64("hello")
	if ok {
		t.Error("expected false for string")
	}
}

func TestToInt64_Nil_False(t *testing.T) {
	_, ok := toInt64(nil)
	if ok {
		t.Error("expected false for nil")
	}
}

func TestToInt64_Bool_False(t *testing.T) {
	_, ok := toInt64(true)
	if ok {
		t.Error("expected false for bool")
	}
}
