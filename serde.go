package fookie

import "reflect"

func schemaToMap[S any](s S) map[string]any {
	out := make(map[string]any)
	collectSchemaValues(reflect.ValueOf(s), out)
	return out
}

func collectSchemaValues(rv reflect.Value, out map[string]any) {
	rt := rv.Type()
	for i := range rt.NumField() {
		sf := rt.Field(i)
		fv := rv.Field(i)

		if sf.Anonymous && fv.Kind() == reflect.Struct {
			collectSchemaValues(fv, out)
			continue
		}

		key := toSnake(sf.Name)
		m := fv.MethodByName("Value")
		if !m.IsValid() && fv.CanAddr() {
			m = fv.Addr().MethodByName("Value")
		}
		if m.IsValid() && m.Type().NumIn() == 0 && m.Type().NumOut() == 1 {
			out[key] = m.Call(nil)[0].Interface()
		}
	}
}

func mapToSchema[S any](m map[string]any, s *S) {
	if s == nil || len(m) == 0 {
		return
	}
	rv := reflect.ValueOf(s).Elem()
	applyMapToValue(m, rv)
}

func applyMapToValue(m map[string]any, rv reflect.Value) {
	rt := rv.Type()
	for i := range rt.NumField() {
		sf := rt.Field(i)
		fv := rv.Field(i)

		if sf.Anonymous && fv.Kind() == reflect.Struct && fv.CanAddr() {
			applyMapToValue(m, fv)
			continue
		}

		key := toSnake(sf.Name)
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
