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

func wireFieldsCollect(rv reflect.Value) []FieldSnapshot {
	if rv.Kind() != reflect.Struct {
		return nil
	}
	rt := rv.Type()
	out := make([]FieldSnapshot, 0, rt.NumField())
	for i := range rt.NumField() {
		sf := rt.Field(i)
		fv := rv.Field(i)
		if sf.Anonymous && fv.Kind() == reflect.Struct {
			out = append(out, wireFieldsCollect(fv)...)
			continue
		}
		typed, ok := fv.Interface().(semantic.TypedField)
		if !ok {
			continue
		}
		name := serde.ToSnake(sf.Name)
		var bind func(semantic.FilterFn)
		if fv.CanAddr() {
			if ks, ok := fv.Addr().Interface().(keySetter); ok {
				ks.SetKey(name)
			}
			if fs, ok := fv.Addr().Interface().(filterSetter); ok {
				setter := fs
				bind = func(fn semantic.FilterFn) {
					setter.SetFilter(fn)
				}
			}
		}
		snap := FieldSnapshot{
			FieldDef:   FieldDef{Name: name, Kind: typed.Kind()},
			bindFilter: bind,
		}
		if tag := sf.Tag.Get("fookie"); tag != "" && fv.CanAddr() {
			applyFieldTags(fv.Addr().Interface(), tag, &snap.FieldDef)
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

func NewStored[S any](m *Model[S]) *StoredModel {
	stored := &StoredModel{
		Name:      m.Name,
		snapshots: EnsureDefaultID(WireFields(&m.Field)),
		def:       m,
	}
	m.stored = stored
	return stored
}

const idColumn = "id"

func EnsureDefaultID(snapshots []FieldSnapshot) []FieldSnapshot {
	for _, s := range snapshots {
		if s.Name == idColumn {
			return snapshots
		}
	}
	return append([]FieldSnapshot{{FieldDef: FieldDef{Name: idColumn, Kind: semantic.IDKind}}}, snapshots...)
}
