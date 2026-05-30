package schemawire

import (
	"github.com/fookiejs/fookie/semantic"
)

type FieldDef struct {
	Name         string
	Kind         Kind
	RelationName string
	Relation     *StoredModel
	Enum         *EnumDef
	Indexed      bool
	Unique       bool
}

type FieldSnapshot struct {
	FieldDef
	bindFilter func(semantic.FilterFn)
}

type StoredModel struct {
	Name      string
	snapshots []FieldSnapshot
	def       any
}

func NewStoredModel(name string, snapshots []FieldSnapshot) *StoredModel {
	return &StoredModel{Name: name, snapshots: snapshots}
}

func (m *StoredModel) Bind(def any) { m.def = def }

func (m *StoredModel) Def() any { return m.def }

func (m *StoredModel) Fields() []FieldDef {
	out := make([]FieldDef, len(m.snapshots))
	for i, s := range m.snapshots {
		out[i] = s.FieldDef
	}
	return out
}

type ListFilter struct {
	Field string
	Op    string
	Value semantic.FilterValue
}
