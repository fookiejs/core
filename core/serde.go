package fookie

import "reflect"

// schemaToMap extracts values from a semantic struct S by calling Value() on each field.
// Only fields that implement Value() are included.
func schemaToMap[S any](s S) map[string]any {
	rv := reflect.ValueOf(s)
	rt := rv.Type()
	out := make(map[string]any, rt.NumField())
	for i := 0; i < rt.NumField(); i++ {
		fv := rv.Field(i)
		key := toSnake(rt.Field(i).Name)
		m := fv.MethodByName("Value")
		if !m.IsValid() && fv.CanAddr() {
			m = fv.Addr().MethodByName("Value")
		}
		if m.IsValid() && m.Type().NumIn() == 0 && m.Type().NumOut() == 1 {
			out[key] = m.Call(nil)[0].Interface()
		}
	}
	return out
}

// mapToSchema populates a semantic struct S by calling Set(val) on each field.
// JSON numbers arrive as float64 from encoding/json — converted as needed.
func mapToSchema[S any](m map[string]any, s *S) {
	if s == nil || len(m) == 0 {
		return
	}
	rv := reflect.ValueOf(s).Elem()
	rt := rv.Type()
	for i := 0; i < rt.NumField(); i++ {
		fv := rv.Field(i)
		key := toSnake(rt.Field(i).Name)
		val, ok := m[key]
		if !ok || val == nil || !fv.CanAddr() {
			continue
		}
		setter := fv.Addr().MethodByName("Set")
		if !setter.IsValid() || setter.Type().NumIn() != 1 {
			continue
		}
		want := setter.Type().In(0)
		got := reflect.ValueOf(val)
		if !got.IsValid() {
			continue
		}
		switch {
		case got.Type().AssignableTo(want):
			setter.Call([]reflect.Value{got})
		case got.Type().ConvertibleTo(want):
			setter.Call([]reflect.Value{got.Convert(want)})
		}
	}
}
