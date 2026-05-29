package model

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

type StoredModel struct {
	Name      string
	snapshots []FieldSnapshot
	def       any
}

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

type Model[S any] struct {
	Name       string
	Field      S
	Operations Operations[S]
	stored     *StoredModel
}

func (m *Model[S]) StoredModel() *StoredModel { return m.stored }

type Operations[S any] struct {
	Create func(*Flow[S]) Signal
	Read   func(*Flow[S]) Signal
	Update func(*Flow[S]) Signal
	Delete func(*Flow[S]) Signal
	List   func(*ListFlow[S]) Signal
}

type External[Input any, Output any] struct {
	Name           string
	Retry          Retry
	IdempotencyKey func(Input) string
}

type Retry struct {
	Attempts    int
	Backoff     string
	MaxDelaySec int
}

type Internal[Input any, Output any] struct {
	Name    string
	Execute func(Input) (Output, error)
}
