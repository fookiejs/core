package model

import (
	"reflect"

	"github.com/fookiejs/fookie/internal/persistence/serde"
	"github.com/fookiejs/fookie/semantic"
)

func AttachFilter[F any](stored *StoredModel, schema F, qb *Builder) F {
	rv := reflect.ValueOf(&schema).Elem()
	attachFilters(rv, qb)
	return schema
}

func attachFilters(rv reflect.Value, qb *Builder) {
	if rv.Kind() != reflect.Struct {
		return
	}
	rt := rv.Type()
	for i := range rt.NumField() {
		sf := rt.Field(i)
		fv := rv.Field(i)
		if sf.Anonymous && fv.Kind() == reflect.Struct {
			attachFilters(fv, qb)
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
			fs.SetFilter(func(op string, val semantic.FilterValue) {
				qb.Add(boundKey, op, val)
			})
		}
	}
}
