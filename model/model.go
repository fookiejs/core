package model

import (
	core "github.com/fookiejs/fookie/internal/model"
	"github.com/fookiejs/fookie/internal/runtime"
)

type (
	Model[S any]                = core.Model[S]
	Operations[S any]           = core.Operations[S]
	Flow[F any]                 = core.Flow[F]
	ListFlow[F any]             = core.ListFlow[F]
	External[Input, Output any] = core.External[Input, Output]
	Internal[Input, Output any] = core.Internal[Input, Output]
	FieldDef                    = core.FieldDef
	EnumDef                     = core.EnumDef
	Retry                       = core.Retry
	FailError                   = core.FailError
	SumContext                  = core.SumContext
	Signal                      = core.Signal
	ID                          = core.ID
	EntityStatus                = core.EntityStatus
	Entity[S any]               = core.Entity[S]
	OpResult                    = core.OpResult
	Composer                    = core.Composer
	ListFilter                  = core.ListFilter
)

const (
	Done    = core.Done
	Running = core.Running
	Failed  = core.Failed
)

var (
	DefineEnum = core.DefineEnum
	NewError   = core.NewError
	NewID      = core.NewID
)

func Create[T any](c core.Composer, target *core.Model[T], input any) (core.ID, core.Signal) {
	return runtime.NestedCreate(c, target, input)
}

func Read[T any](c core.Composer, target *core.Model[T], id core.ID) (core.Entity[T], core.Signal) {
	return runtime.NestedRead(c, target, id)
}

func Update[T any](c core.Composer, target *core.Model[T], id core.ID, patch any) core.Signal {
	return runtime.NestedUpdate(c, target, id, patch)
}

func Delete[T any](c core.Composer, target *core.Model[T], id core.ID) core.Signal {
	return runtime.NestedDelete(c, target, id)
}

func ListFor[T any](c core.Composer, target *core.Model[T], cursor string, extra []core.ListFilter) ([]core.Entity[T], string, core.Signal) {
	return runtime.NestedListFor(c, target, cursor, extra)
}
