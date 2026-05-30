package flowext

import (
	"github.com/fookiejs/fookie/internal/model/schemawire"
)

type Model[S any] struct {
	Name       string
	Field      S
	Operations Operations[S]
	stored     *schemawire.StoredModel
}

func (m *Model[S]) StoredModel() *schemawire.StoredModel { return m.stored }

type Operations[S any] struct {
	Create func(*Flow[S]) schemawire.Signal
	Read   func(*Flow[S]) schemawire.Signal
	Update func(*Flow[S]) schemawire.Signal
	Delete func(*Flow[S]) schemawire.Signal
	List   func(*ListFlow[S]) schemawire.Signal
}

type External[Input any, Output any] struct {
	Name  string
	Retry Retry
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

func NewStored[S any](modelDefinition *Model[S]) *schemawire.StoredModel {
	stored := schemawire.NewStoredModel(
		modelDefinition.Name,
		schemawire.EnsureBaseFields(schemawire.WireFields(&modelDefinition.Field)),
	)
	stored.Bind(modelDefinition)
	modelDefinition.stored = stored
	return stored
}
