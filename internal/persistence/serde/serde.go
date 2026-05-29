package serde

import (
	"reflect"
	"strings"
	"unicode"

	"github.com/fookiejs/fookie/internal/persistence/row"
	"github.com/fookiejs/fookie/semantic"
)

var baseType = reflect.TypeOf(semantic.Base{})

func ToSnake(name string) string {
	runes := []rune(name)
	var builder strings.Builder
	for i, character := range runes {
		if unicode.IsUpper(character) {
			if i > 0 {
				prev := runes[i-1]
				var next rune
				if i+1 < len(runes) {
					next = runes[i+1]
				}
				if unicode.IsLower(prev) || (unicode.IsUpper(prev) && next != 0 && unicode.IsLower(next)) {
					builder.WriteByte('_')
				}
			}
			builder.WriteRune(unicode.ToLower(character))
		} else {
			builder.WriteRune(character)
		}
	}
	return builder.String()
}

func ToRow[S any](s S) row.Map {
	out := make(row.Map)
	collectSchemaValues(reflect.ValueOf(s), out)
	return out
}

func ToPatchRow[S any](s S) row.Map {
	out := make(row.Map)
	collectPatchValues(reflect.ValueOf(s), out)
	return out
}

func collectPatchValues(rv reflect.Value, out row.Map) {
	collectRowValues(rv, out, true)
}

func collectSchemaValues(rv reflect.Value, out row.Map) {
	collectRowValues(rv, out, false)
}

func collectRowValues(rv reflect.Value, out row.Map, patchOnly bool) {
	rt := rv.Type()
	for i := range rt.NumField() {
		structField := rt.Field(i)
		fieldValue := rv.Field(i)

		if structField.Anonymous && fieldValue.Kind() == reflect.Struct {
			if fieldValue.Type() == baseType {
				collectBaseValues(fieldValue, out, patchOnly)
			} else {
				collectRowValues(fieldValue, out, patchOnly)
			}
			continue
		}

		if patchOnly && fieldValue.IsZero() {
			continue
		}

		key := ToSnake(structField.Name)
		if rv, ok := rowValueFromField(fieldValue); ok {
			out[key] = row.FromValue(rv)
		}
	}
}

func collectBaseValues(fieldValue reflect.Value, out row.Map, patchOnly bool) {
	for i := range baseType.NumField() {
		structField := baseType.Field(i)
		if semantic.IsProtectedBaseField(structField.Name) {
			continue
		}
		bfv := fieldValue.Field(i)
		if patchOnly && bfv.IsZero() {
			continue
		}
		key := ToSnake(structField.Name)
		if rv, ok := rowValueFromField(bfv); ok {
			out[key] = row.FromValue(rv)
		}
	}
}

func FilterInputRow(m row.Map) row.Map {
	if len(m) == 0 {
		return m
	}
	out := make(row.Map, len(m))
	for k, v := range m {
		if IsProtectedBaseColumn(k) {
			continue
		}
		out[k] = v
	}
	return out
}

func IsProtectedBaseColumn(name string) bool {
	for i := range baseType.NumField() {
		sf := baseType.Field(i)
		if !semantic.IsProtectedBaseField(sf.Name) {
			continue
		}
		if ToSnake(sf.Name) == name {
			return true
		}
	}
	return false
}

func rowValueFromField(fieldValue reflect.Value) (any, bool) {
	if fieldValue.CanAddr() {
		if rf, ok := fieldValue.Addr().Interface().(semantic.RowField); ok {
			return rf.RowValue(), true
		}
	}
	tmp := reflect.New(fieldValue.Type()).Elem()
	tmp.Set(fieldValue)
	if rf, ok := tmp.Addr().Interface().(semantic.RowField); ok {
		return rf.RowValue(), true
	}
	return nil, false
}

func FieldValue(s any, snakeName string) (any, bool) {
	if s == nil {
		return nil, false
	}
	reflectValue := reflect.ValueOf(s)
	if reflectValue.Kind() == reflect.Pointer {
		if reflectValue.IsNil() {
			return nil, false
		}
		reflectValue = reflectValue.Elem()
	}
	if reflectValue.Kind() != reflect.Struct {
		return nil, false
	}
	return fieldValueWalk(reflectValue, snakeName)
}

func fieldValueWalk(rv reflect.Value, snakeName string) (any, bool) {
	rt := rv.Type()
	for i := range rt.NumField() {
		sf := rt.Field(i)
		fieldValue := rv.Field(i)
		if sf.Anonymous && fieldValue.Kind() == reflect.Struct {
			if v, ok := fieldValueWalk(fieldValue, snakeName); ok {
				return v, true
			}
			continue
		}
		if ToSnake(sf.Name) != snakeName {
			continue
		}
		return rowValueFromField(fieldValue)
	}
	return nil, false
}

func FromRow[S any](m row.Map, s *S) {
	if s == nil || len(m) == 0 {
		return
	}
	rv := reflect.ValueOf(s).Elem()
	applyRowToValue(m, rv)
}

func applyRowToValue(dataMap row.Map, rv reflect.Value) {
	rt := rv.Type()
	for i := range rt.NumField() {
		structField := rt.Field(i)
		fieldValue := rv.Field(i)

		if structField.Anonymous && fieldValue.Kind() == reflect.Struct && fieldValue.CanAddr() {
			applyRowToValue(dataMap, fieldValue)
			continue
		}

		key := ToSnake(structField.Name)
		cell, ok := dataMap[key]
		if !ok || cell.Kind == row.KindEmpty || !fieldValue.CanAddr() {
			continue
		}
		rf, ok := fieldValue.Addr().Interface().(semantic.RowField)
		if !ok {
			continue
		}
		rf.RowSet(cell.DriverValue(false))
	}
}
