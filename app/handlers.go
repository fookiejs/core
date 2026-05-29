package app

import "github.com/fookiejs/fookie/internal/model"

func registerHandler[Input, Output any](a *App, ext model.External[Input, Output], handler func(Input) (Output, error)) {
	a.externalHandlers[ext.Name] = model.WrapExternalHandler(handler)
	registerExternalTypes[Input, Output](a, ext.Name)
}

func RegisterCompensation[Input, Output any](a *App, name string, compensate func(Input, Output) error) {
	compensateName := name + ".compensate"
	a.externalHandlers[compensateName] = model.WrapCompensationHandler(compensate)
	a.compensationLinks[name] = compensateName
}
