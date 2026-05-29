package model

import (
	"reflect"
	"strings"

	"github.com/fookiejs/fookie/internal/persistence/serde"
	"github.com/fookiejs/fookie/semantic"
)

type FieldSnapshot struct {
	FieldDef
	bindFilter func(semantic.FilterFn)
}

type keySetter interface {
	SetKey(string)
}

type tagApplier interface {
	ApplyTag(part string, schema *semantic.SchemaFlags) bool
}

type filterSetter interface {
	SetKey(string)
	SetFilter(semantic.FilterFn)
}

func WireFields(schema any) []FieldSnapshot {
	rv := reflect.ValueOf(schema)
	if rv.Kind() == reflect.Pointer {
		rv = rv.Elem()
	}
	return wireFieldsCollect(rv)
}

func wireFieldsCollect(reflectValue reflect.Value) []FieldSnapshot {
	if reflectValue.Kind() != reflect.Struct {
		return nil
	}
	rt := reflectValue.Type()
	out := make([]FieldSnapshot, 0, rt.NumField())
	for i := range rt.NumField() {
		structField := rt.Field(i)
		fieldValue := reflectValue.Field(i)
		if structField.Anonymous && fieldValue.Kind() == reflect.Struct {
			out = append(out, wireFieldsCollect(fieldValue)...)
			continue
		}
		typed, ok := fieldValue.Interface().(semantic.TypedField)
		if !ok {
			continue
		}
		name := serde.ToSnake(structField.Name)
		var bind func(semantic.FilterFn)
		if fieldValue.CanAddr() {
			if ks, ok := fieldValue.Addr().Interface().(keySetter); ok {
				ks.SetKey(name)
			}
			if fs, ok := fieldValue.Addr().Interface().(filterSetter); ok {
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
	}
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

func NewStored[S any](modelDefinition *Model[S]) *StoredModel {
	stored := &StoredModel{
		Name:      modelDefinition.Name,
		snapshots: EnsureBaseFields(WireFields(&modelDefinition.Field)),
		def:       modelDefinition,
	}
	modelDefinition.stored = stored
	return stored
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
