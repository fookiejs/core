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
		sf := rt.Field(i)
		fv := reflectValue.Field(i)
		if sf.Anonymous && fv.Kind() == reflect.Struct {
			attachFilters(fv, queryBuilder)
			continue
		}
		if !fv.CanAddr() {
			continue
		}
		if _, ok := fv.Interface().(semantic.TypedField); !ok {
			continue
		}
		key := serde.ToSnake(sf.Name)
		addr := fv.Addr().Interface()
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
