package query

import (
	"reflect"

	"github.com/fookiejs/fookie/internal/model/schemawire"
	"github.com/fookiejs/fookie/internal/persistence/serde"
	"github.com/fookiejs/fookie/semantic"
)

func AttachFilter[F any](stored *schemawire.StoredModel, schema F, queryBuilder *Builder) F {
	root := reflect.ValueOf(&schema).Elem()
	schemawire.WalkSchemaFields(root, func(structField reflect.StructField, fieldValue reflect.Value) {
		if !fieldValue.CanAddr() {
			return
		}
		if _, ok := fieldValue.Interface().(semantic.TypedField); !ok {
			return
		}
		key := serde.ToSnake(structField.Name)
		address := fieldValue.Addr().Interface()
		if ks, ok := address.(schemawire.KeySetter); ok {
			ks.SetKey(key)
		}
		if fs, ok := address.(schemawire.FilterSetter); ok {
			boundKey := key
			fs.SetFilter(func(operation string, val semantic.FilterValue) {
				queryBuilder.Add(boundKey, operation, val)
			})
		}
	})
	return schema
}
