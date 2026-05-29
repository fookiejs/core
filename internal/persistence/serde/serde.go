package serde

import (
	"reflect"
	"strings"
	"unicode"

	"github.com/fookiejs/fookie/internal/persistence/row"
	"github.com/fookiejs/fookie/semantic"
)

func ToSnake(name string) string {
	runes := []rune(name)
	var b strings.Builder
	for i, r := range runes {
		if unicode.IsUpper(r) {
			if i > 0 {
				prev := runes[i-1]
				var next rune
				if i+1 < len(runes) {
					next = runes[i+1]
				}
				if unicode.IsLower(prev) || (unicode.IsUpper(prev) && next != 0 && unicode.IsLower(next)) {
					b.WriteByte('_')
				}
			}
			b.WriteRune(unicode.ToLower(r))
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
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
	rt := rv.Type()
	for i := range rt.NumField() {
		sf := rt.Field(i)
		fv := rv.Field(i)

		if sf.Anonymous && fv.Kind() == reflect.Struct {
			collectPatchValues(fv, out)
			continue
		}

		if fv.IsZero() {
			continue
		}

		key := ToSnake(sf.Name)
		if rv, ok := rowValueFromField(fv); ok {
			out[key] = row.FromValue(rv)
		}
	}
}

func collectSchemaValues(rv reflect.Value, out row.Map) {
	rt := rv.Type()
	for i := range rt.NumField() {
		sf := rt.Field(i)
		fv := rv.Field(i)

		if sf.Anonymous && fv.Kind() == reflect.Struct {
			collectSchemaValues(fv, out)
			continue
		}

		key := ToSnake(sf.Name)
		if rv, ok := rowValueFromField(fv); ok {
			out[key] = row.FromValue(rv)
		}
	}
}

func rowValueFromField(fv reflect.Value) (any, bool) {
	if fv.CanAddr() {
		if rf, ok := fv.Addr().Interface().(semantic.RowField); ok {
			return rf.RowValue(), true
		}
	}
	tmp := reflect.New(fv.Type()).Elem()
	tmp.Set(fv)
	if rf, ok := tmp.Addr().Interface().(semantic.RowField); ok {
		return rf.RowValue(), true
	}
	return nil, false
}

func FieldValue(s any, snakeName string) (any, bool) {
	if s == nil {
		return nil, false
	}
	rv := reflect.ValueOf(s)
	if rv.Kind() == reflect.Pointer {
		if rv.IsNil() {
			return nil, false
		}
		rv = rv.Elem()
	}
	if rv.Kind() != reflect.Struct {
		return nil, false
	}
	return fieldValueWalk(rv, snakeName)
}

func fieldValueWalk(rv reflect.Value, snakeName string) (any, bool) {
	rt := rv.Type()
	for i := range rt.NumField() {
		sf := rt.Field(i)
		fv := rv.Field(i)
		if sf.Anonymous && fv.Kind() == reflect.Struct {
			if v, ok := fieldValueWalk(fv, snakeName); ok {
				return v, true
			}
			continue
		}
		if ToSnake(sf.Name) != snakeName {
			continue
		}
		return rowValueFromField(fv)
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

func applyRowToValue(m row.Map, rv reflect.Value) {
	rt := rv.Type()
	for i := range rt.NumField() {
		sf := rt.Field(i)
		fv := rv.Field(i)

		if sf.Anonymous && fv.Kind() == reflect.Struct && fv.CanAddr() {
			applyRowToValue(m, fv)
			continue
		}

		key := ToSnake(sf.Name)
		cell, ok := m[key]
		if !ok || cell.Kind == row.KindEmpty || !fv.CanAddr() {
			continue
		}
		rf, ok := fv.Addr().Interface().(semantic.RowField)
		if !ok {
			continue
		}
		rf.RowSet(cell.DriverValue(false))
	}
}
