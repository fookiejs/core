package runtime

import (
	"context"

	"github.com/fookiejs/fookie/internal/model"
	"github.com/fookiejs/fookie/internal/persistence/row"
)

type Engine struct {
	Create func(context.Context, map[string]string, row.Map) (model.OpResult, error)
	Read   func(context.Context, map[string]string, model.ID) (model.Record, error)
	Update func(context.Context, map[string]string, model.ID, row.Map) (model.OpResult, error)
	Delete func(context.Context, map[string]string, model.ID) error
	List   func(context.Context, map[string]string, string, []model.ListFilter) ([]model.Record, string, error)
	Resume func(model.ID) error
	Decode func(row.Map) model.Record
}

func BuildEngine[S any](a model.AppRef, modelDefinition *model.Model[S]) *Engine {
	stored := modelDefinition.StoredModel()
	return &Engine{
		Create: func(ctx context.Context, headers map[string]string, body row.Map) (model.OpResult, error) {
			return runCreate(a, stored, modelDefinition.Operations.Create, ctx, headers, body)
		},
		Read: func(ctx context.Context, headers map[string]string, id model.ID) (model.Record, error) {
			return runRead(a, stored, modelDefinition.Operations.Read, ctx, headers, id)
		},
		Update: func(ctx context.Context, headers map[string]string, id model.ID, body row.Map) (model.OpResult, error) {
			return runUpdate(a, stored, modelDefinition.Operations.Update, ctx, headers, id, body)
		},
		Delete: func(ctx context.Context, headers map[string]string, id model.ID) error {
			return runDelete(a, stored, modelDefinition.Operations.Delete, ctx, headers, id)
		},
		List: func(ctx context.Context, headers map[string]string, cursor string, extra []model.ListFilter) ([]model.Record, string, error) {
			return runList(a, stored, modelDefinition, modelDefinition.Operations.List, ctx, headers, cursor, extra)
		},
		Resume: func(id model.ID) error {
			return runResume(a, stored, modelDefinition.Operations.Create, id)
		},
		Decode: func(rm row.Map) model.Record { return decodeRecord[S](rm) },
	}
}
