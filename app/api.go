package app

import (
	"context"
	"log/slog"

	coremodel "github.com/fookiejs/fookie/internal/model"
	"github.com/fookiejs/fookie/internal/observability"
	"github.com/fookiejs/fookie/internal/persistence/row"
	"github.com/fookiejs/fookie/internal/persistence/serde"
	pubmodel "github.com/fookiejs/fookie/model"
)

func inputRow(input any) row.Map {
	switch v := input.(type) {
	case nil:
		return row.Map{}
	case row.Map:
		return v
	case map[string]any:
		return row.FromAnyMap(v)
	default:
		return serde.ToPatchRow(input)
	}
}

func Create[S any](app *App, model *pubmodel.Model[S], headers map[string]string, input S) (string, error) {
	res, err := app.engines[model.Name].Create(context.Background(), headers, serde.ToRow(input))
	if err != nil {
		return "", err
	}
	return res.ID.String(), nil
}

func Update[S any](app *App, model *pubmodel.Model[S], headers map[string]string, id string, patch any) (string, error) {
	res, err := app.engines[model.Name].Update(context.Background(), headers, coremodel.ID(id), inputRow(patch))
	if err != nil {
		return "", err
	}
	return res.ID.String(), nil
}

func Delete[S any](app *App, model *pubmodel.Model[S], headers map[string]string, id string) error {
	return app.engines[model.Name].Delete(context.Background(), headers, coremodel.ID(id))
}

type Handler[Input, Output any] struct {
	app  *App
	name string
}

func RegisterHandler[Input, Output any](app *App, ext pubmodel.External[Input, Output], handler func(Input) (Output, error)) Handler[Input, Output] {
	registerHandler(app, ext, handler)
	return Handler[Input, Output]{app: app, name: ext.Name}
}

func (h Handler[Input, Output]) Compensate(compensate func(Input, Output) error) {
	RegisterCompensation[Input, Output](h.app, h.name, compensate)
}

func SetLogger(l *slog.Logger) { observability.SetLogger(l) }
