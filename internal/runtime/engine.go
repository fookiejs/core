package runtime

import (
	"context"

	"github.com/fookiejs/fookie/internal/model"
	"github.com/fookiejs/fookie/internal/persistence/row"
)

type Engine struct {
	Create func(context.Context, map[string]string, row.Values) (model.OpResult, error)
	Read   func(context.Context, map[string]string, model.ID) (model.Record, error)
	Update func(context.Context, map[string]string, model.ID, row.Values) (model.OpResult, error)
	Delete func(context.Context, map[string]string, model.ID) error
	List   func(context.Context, map[string]string, string, []model.ListFilter) ([]model.Record, string, error)
	Resume func(model.ID) error
	Decode func(row.Values) model.Record
}

func BuildEngine[Schema any](application model.AppRef, modelDefinition *model.Model[Schema]) *Engine {
	stored := modelDefinition.StoredModel()
	return &Engine{
		Create: func(ctx context.Context, headers map[string]string, body row.Values) (model.OpResult, error) {
			return runCreate(application, stored, modelDefinition.Operations.Create, ctx, headers, body)
		},
		Read: func(ctx context.Context, headers map[string]string, id model.ID) (model.Record, error) {
			return runRead(application, stored, modelDefinition.Operations.Read, ctx, headers, id)
		},
		Update: func(ctx context.Context, headers map[string]string, id model.ID, body row.Values) (model.OpResult, error) {
			return runUpdate(application, stored, modelDefinition.Operations.Update, ctx, headers, id, body)
		},
		Delete: func(ctx context.Context, headers map[string]string, id model.ID) error {
			return runDelete(application, stored, modelDefinition.Operations.Delete, ctx, headers, id)
		},
		List: func(ctx context.Context, headers map[string]string, cursor string, extra []model.ListFilter) ([]model.Record, string, error) {
			return runList(application, stored, modelDefinition, modelDefinition.Operations.List, ctx, headers, cursor, extra)
		},
		Resume: func(id model.ID) error {
			return runResume(application, stored, modelDefinition.Operations.Create, id)
		},
		Decode: func(rm row.Values) model.Record { return decodeRecord[Schema](rm) },
	}
}
