package model

import (
	"github.com/fookiejs/fookie/internal/model/flowext"
	"github.com/fookiejs/fookie/internal/model/query"
	"github.com/fookiejs/fookie/internal/model/schemawire"
	"github.com/fookiejs/fookie/internal/runtime"
)

type (
	Model[S any]                = flowext.Model[S]
	Operations[S any]           = flowext.Operations[S]
	Flow[F any]                 = flowext.Flow[F]
	ListFlow[F any]             = flowext.ListFlow[F]
	External[Input, Output any] = flowext.External[Input, Output]
	Internal[Input, Output any] = flowext.Internal[Input, Output]
	FieldDef                    = schemawire.FieldDef
	EnumDef                     = schemawire.EnumDef
	Retry                       = flowext.Retry
	FailError                   = schemawire.FailError
	SumContext                  = query.SumContext
	Signal                      = schemawire.Signal
	ID                          = schemawire.ID
	EntityStatus                = schemawire.EntityStatus
	Entity[S any]               = schemawire.Entity[S]
	OpResult                    = schemawire.OpResult
	Composer                    = flowext.Composer
	ListFilter                  = schemawire.ListFilter
)

const (
	Done    = schemawire.Done
	Running = schemawire.Running
	Failed  = schemawire.Failed
)

var (
	DefineEnum = schemawire.DefineEnum
	NewError   = schemawire.NewError
	NewID      = schemawire.NewID
)

func Create[T any](c flowext.Composer, target *flowext.Model[T], input any) (schemawire.ID, schemawire.Signal) {
	return runtime.NestedCreate(c, target, input)
}

func Read[T any](c flowext.Composer, target *flowext.Model[T], id schemawire.ID) (schemawire.Entity[T], schemawire.Signal) {
	return runtime.NestedRead(c, target, id)
}

func Update[T any](c flowext.Composer, target *flowext.Model[T], id schemawire.ID, patch any) schemawire.Signal {
	return runtime.NestedUpdate(c, target, id, patch)
}

func Delete[T any](c flowext.Composer, target *flowext.Model[T], id schemawire.ID) schemawire.Signal {
	return runtime.NestedDelete(c, target, id)
}

func ListFor[T any](c flowext.Composer, target *flowext.Model[T], cursor string, extra []schemawire.ListFilter) ([]schemawire.Entity[T], string, schemawire.Signal) {
	return runtime.NestedListFor(c, target, cursor, extra)
}
