package schemawire

import (
	"reflect"
	"strings"

	"github.com/fookiejs/fookie/internal/persistence/serde"
	"github.com/fookiejs/fookie/semantic"
)

type KeySetter interface {
	SetKey(string)
}

type FilterSetter interface {
	SetKey(string)
	SetFilter(semantic.FilterFn)
}

type tagApplier interface {
	ApplyTag(part string, schema *semantic.SchemaFlags) bool
}

func WireFields(schema any) []FieldSnapshot {
	root := reflect.ValueOf(schema)
	if root.Kind() == reflect.Pointer {
		root = root.Elem()
	}
	return wireFieldsCollect(root)
}

func WalkSchemaFields(root reflect.Value, visit func(structField reflect.StructField, fieldValue reflect.Value)) {
	if root.Kind() != reflect.Struct {
		return
	}
	structType := root.Type()
	for index := range structType.NumField() {
		structField := structType.Field(index)
		fieldValue := root.Field(index)
		if structField.Anonymous && fieldValue.Kind() == reflect.Struct {
			WalkSchemaFields(fieldValue, visit)
			continue
		}
		visit(structField, fieldValue)
	}
}

func wireFieldsCollect(root reflect.Value) []FieldSnapshot {
	var out []FieldSnapshot
	WalkSchemaFields(root, func(structField reflect.StructField, fieldValue reflect.Value) {
		typed, ok := fieldValue.Interface().(semantic.TypedField)
		if !ok {
			return
		}
		name := serde.ToSnake(structField.Name)
		var bind func(semantic.FilterFn)
		if fieldValue.CanAddr() {
			if ks, ok := fieldValue.Addr().Interface().(KeySetter); ok {
				ks.SetKey(name)
			}
			if fs, ok := fieldValue.Addr().Interface().(FilterSetter); ok {
				setter := fs
				bind = func(callback semantic.FilterFn) {
					setter.SetFilter(callback)
				}
			}
		}
		snap := FieldSnapshot{
			FieldDef:   FieldDef{Name: name, Kind: typed.Kind()},
			bindFilter: bind,
		}
		if tag := structField.Tag.Get("fookie"); tag != "" && fieldValue.CanAddr() {
			applyFieldTags(fieldValue.Addr().Interface(), tag, &snap.FieldDef)
		}
		out = append(out, snap)
	})
	return out
}

func applyFieldTags(field any, tag string, def *FieldDef) {
	for _, part := range strings.Split(tag, ",") {
		part = strings.TrimSpace(part)
		if part == "" {
			continue
		}
		var flags semantic.SchemaFlags
		if ap, ok := field.(tagApplier); ok {
			ap.ApplyTag(part, &flags)
		} else {
			semantic.ApplySchemaTag(part, &flags)
		}
		mergeSchemaFlags(def, &flags)
	}
}

func mergeSchemaFlags(def *FieldDef, flags *semantic.SchemaFlags) {
	if flags.Indexed {
		def.Indexed = true
	}
	if flags.Unique {
		def.Unique = true
	}
	if flags.Relation != "" {
		def.RelationName = flags.Relation
	}
}

const (
	idColumn        = "id"
	createdAtColumn = "created_at"
	updatedAtColumn = "updated_at"
	isDeletedColumn = "is_deleted"
)

func EnsureBaseFields(snapshots []FieldSnapshot) []FieldSnapshot {
	has := map[string]bool{}
	for _, s := range snapshots {
		has[s.Name] = true
	}
	defaults := []FieldSnapshot{
		{FieldDef: FieldDef{Name: idColumn, Kind: semantic.IDKind}},
		{FieldDef: FieldDef{Name: createdAtColumn, Kind: semantic.TimestampKind}},
		{FieldDef: FieldDef{Name: updatedAtColumn, Kind: semantic.TimestampKind}},
		{FieldDef: FieldDef{Name: isDeletedColumn, Kind: semantic.BoolKind}},
	}
	for _, d := range defaults {
		if !has[d.Name] {
			snapshots = append(snapshots, d)
		}
	}
	return snapshots
}
