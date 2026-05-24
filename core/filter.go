package fookie

import "reflect"

// filterSetter is implemented by all semantic types via SetFilter(key, fn).
type filterSetter interface {
	SetFilter(key string, fn func(string, any))
}

// attachFilter wires each semantic field in schema to qb.
// Sets both the filter fn (for Eq/Gte/Lte) and key (for OrderKey/Desc/Asc).
func attachFilter[F any](schema F, qb *queryBuilder) F {
	rv := reflect.ValueOf(&schema).Elem()
	rt := rv.Type()
	for i := 0; i < rt.NumField(); i++ {
		fv := rv.Field(i)
		if !fv.CanAddr() {
			continue
		}
		key := toSnake(rt.Field(i).Name)
		ptr := fv.Addr().Interface()
		if fs, ok := ptr.(filterSetter); ok {
			capturedQB := qb
			capturedKey := key
			fs.SetFilter(capturedKey, func(op string, val any) {
				capturedQB.add(capturedKey, op, val)
			})
		}
	}
	return schema
}

// attachFieldKeys returns a zero-value F where every semantic field has its
// OrderKey populated (key only — no filter fn).  Used to populate Model.Field
// at Register time so callers can write ctx.OrderBy(Account.Field.DailyLimit).
func attachFieldKeys[F any]() F {
	var schema F
	rv := reflect.ValueOf(&schema).Elem()
	rt := rv.Type()
	for i := 0; i < rt.NumField(); i++ {
		fv := rv.Field(i)
		if !fv.CanAddr() {
			continue
		}
		key := toSnake(rt.Field(i).Name)
		ptr := fv.Addr().Interface()
		if fs, ok := ptr.(filterSetter); ok {
			fs.SetFilter(key, nil)
		}
	}
	return schema
}
