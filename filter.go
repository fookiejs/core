package fookie

import "reflect"

type filterSetter interface {
	SetFilter(key string, fn func(string, any))
}

func attachFilter[F any](schema F, qb *queryBuilder) F {
	rv := reflect.ValueOf(&schema).Elem()
	attachFilterFields(rv, qb)
	return schema
}

func attachFilterFields(rv reflect.Value, qb *queryBuilder) {
	rt := rv.Type()
	for i := range rt.NumField() {
		sf := rt.Field(i)
		fv := rv.Field(i)

		if sf.Anonymous && fv.Kind() == reflect.Struct && fv.CanAddr() {
			attachFilterFields(fv, qb)
			continue
		}

		if !fv.CanAddr() {
			continue
		}
		key := toSnake(sf.Name)
		ptr := fv.Addr().Interface()
		if fs, ok := ptr.(filterSetter); ok {
			capturedQB := qb
			capturedKey := key
			fs.SetFilter(capturedKey, func(op string, val any) {
				capturedQB.add(capturedKey, op, val)
			})
		}
	}
}

func attachFieldKeys[F any]() F {
	var schema F
	rv := reflect.ValueOf(&schema).Elem()
	setFieldKeys(rv)
	return schema
}

func setFieldKeys(rv reflect.Value) {
	rt := rv.Type()
	for i := range rt.NumField() {
		sf := rt.Field(i)
		fv := rv.Field(i)

		if sf.Anonymous && fv.Kind() == reflect.Struct && fv.CanAddr() {
			setFieldKeys(fv)
			continue
		}

		if !fv.CanAddr() {
			continue
		}
		key := toSnake(sf.Name)
		ptr := fv.Addr().Interface()
		if fs, ok := ptr.(filterSetter); ok {
			fs.SetFilter(key, nil)
		}
	}
}
