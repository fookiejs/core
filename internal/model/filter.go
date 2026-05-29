package model

import (
	"reflect"

	"github.com/fookiejs/fookie/internal/persistence/serde"
	"github.com/fookiejs/fookie/semantic"
)

func AttachFilter[F any](stored *StoredModel, schema F, queryBuilder *Builder) F {
	rv := reflect.ValueOf(&schema).Elem()
	attachFilters(rv, queryBuilder)
	return schema
}

func attachFilters(reflectValue reflect.Value, queryBuilder *Builder) {
	if reflectValue.Kind() != reflect.Struct {
		return
	}
	rt := reflectValue.Type()
	for i := range rt.NumField() {
		structField := rt.Field(i)
		fieldValue := reflectValue.Field(i)
		if structField.Anonymous && fieldValue.Kind() == reflect.Struct {
			attachFilters(fieldValue, queryBuilder)
			continue
		}
		if !fieldValue.CanAddr() {
			continue
		}
		if _, ok := fieldValue.Interface().(semantic.TypedField); !ok {
			continue
		}
		key := serde.ToSnake(structField.Name)
		addr := fieldValue.Addr().Interface()
		if ks, ok := addr.(keySetter); ok {
			ks.SetKey(key)
		}
		if fs, ok := addr.(filterSetter); ok {
			boundKey := key
			fs.SetFilter(func(operation string, val semantic.FilterValue) {
				queryBuilder.Add(boundKey, operation, val)
			})
		}
	}
}
