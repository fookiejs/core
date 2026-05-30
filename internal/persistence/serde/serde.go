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

func Values[Schema any](schema Schema) row.Values {
	root := addressableStruct(reflect.ValueOf(schema))
	metas := metaFor(root.Type())
	out := make(row.Values, 0, len(metas))
	for _, meta := range metas {
		rowField := root.FieldByIndex(meta.index).Addr().Interface().(semantic.RowField)
		out = append(out, row.Field{Column: meta.column, Cell: row.FromValue(rowField.RowValue())})
	}
	return out
}

func PatchValues[Schema any](schema Schema) row.Values {
	root := addressableStruct(reflect.ValueOf(schema))
	out := make(row.Values, 0)
	for _, meta := range metaFor(root.Type()) {
		field := root.FieldByIndex(meta.index)
		if field.IsZero() {
			continue
		}
		out = append(out, row.Field{Column: meta.column, Cell: row.FromValue(field.Addr().Interface().(semantic.RowField).RowValue())})
	}
	return out
}

func IntoStruct[Schema any](values row.Values, schema *Schema) {
	if schema == nil || len(values) == 0 {
		return
	}
	root := reflect.ValueOf(schema).Elem()
	for _, meta := range metaFor(root.Type()) {
		cell, ok := values.Find(meta.column)
		if !ok || cell.Kind == row.KindEmpty {
			continue
		}
		root.FieldByIndex(meta.index).Addr().Interface().(semantic.RowField).RowSet(cell.DriverValue(false))
	}
}

func FieldValue(schema any, snakeName string) (any, bool) {
	if schema == nil {
		return nil, false
	}
	reflectValue := reflect.ValueOf(schema)
	if reflectValue.Kind() == reflect.Pointer {
		if reflectValue.IsNil() {
			return nil, false
		}
		reflectValue = reflectValue.Elem()
	}
	if reflectValue.Kind() != reflect.Struct {
		return nil, false
	}
	root := addressableStruct(reflectValue)
	for _, meta := range metaFor(root.Type()) {
		if meta.column != snakeName {
			continue
		}
		return root.FieldByIndex(meta.index).Addr().Interface().(semantic.RowField).RowValue(), true
	}
	return nil, false
}

func FilterInputRow(values row.Values) row.Values {
	out := make(row.Values, 0, len(values))
	for _, field := range values {
		if IsProtectedBaseColumn(field.Column) {
			continue
		}
		out = append(out, field)
	}
	return out
}

func IsProtectedBaseColumn(name string) bool {
	for i := range baseType.NumField() {
		structField := baseType.Field(i)
		if !semantic.IsProtectedBaseField(structField.Name) {
			continue
		}
		if ToSnake(structField.Name) == name {
			return true
		}
	}
	return false
}
