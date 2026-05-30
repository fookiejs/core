package app

import "github.com/fookiejs/fookie/internal/model/flowext"

func registerHandler[Input, Output any](a *App, ext flowext.External[Input, Output], handler func(Input) (Output, error)) {
	a.externalHandlers[ext.Name] = flowext.WrapExternalHandler(handler)
	registerExternalTypes[Input, Output](a, ext.Name)
}

func RegisterCompensation[Input, Output any](a *App, name string, compensate func(Input, Output) error) {
	compensateName := name + ".compensate"
	a.externalHandlers[compensateName] = flowext.WrapCompensationHandler(compensate)
	a.compensationLinks[name] = compensateName
}
