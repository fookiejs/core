package fookie

import (
	"reflect"
	"strconv"
	"strings"
	"unicode"
)

// semanticPkg is the import path for the semantic sub-package.
const semanticPkg = "github.com/fookiejs/demo/fookie/semantic"

// semanticKind maps a semantic type (by package path + type name) to a storage kind.
func semanticKind(t reflect.Type) (kind, bool) {
	if t.PkgPath() != semanticPkg {
		return "", false
	}
	switch t.Name() {
	case "String":
		return stringKind, true
	case "Int":
		return int64Kind, true
	case "Float":
		return float64Kind, true
	case "Bool":
		return boolKind, true
	case "ID":
		return idKind, true
	case "Currency":
		return currencyKind, true
	case "Email":
		return emailKind, true
	case "JSON":
		return jsonKind, true
	case "Enum":
		return enumKind, true
	case "Timestamp":
		return timestampKind, true
	case "Date":
		return dateKind, true
	case "URL":
		return urlKind, true
	case "Phone":
		return phoneKind, true
	case "UUID":
		return uuidKind, true
	case "Color":
		return colorKind, true
	case "Locale":
		return localeKind, true
	case "IBAN":
		return ibanKind, true
	case "IP":
		return ipKind, true
	case "Coordinate":
		return coordinateKind, true
	}
	return "", false
}

// applyTag parses a "fookie" struct tag and updates the FieldDef accordingly.
// Supported tokens: indexed, unique, min=N, max=N, relation:ModelName.
func applyTag(def *FieldDef, tag string) {
	for _, part := range strings.Split(tag, ",") {
		part = strings.TrimSpace(part)
		switch {
		case part == "indexed":
			def.Indexed = true
		case part == "unique":
			def.Unique = true
		case strings.HasPrefix(part, "min="):
			if v, err := strconv.ParseInt(strings.TrimPrefix(part, "min="), 10, 64); err == nil {
				def.Min = &v
			}
		case strings.HasPrefix(part, "max="):
			if v, err := strconv.ParseInt(strings.TrimPrefix(part, "max="), 10, 64); err == nil {
				def.Max = &v
			}
		// relation:ModelName — resolved at Register time via resolveRelations(app, fields, schema)
		}
	}
}

// fieldsFromSchema introspects a schema struct and returns a FieldDef slice.
// Only semantic types (package: github.com/fookiejs/demo/fookie/semantic) are recognised.
func fieldsFromSchema(schema any) []FieldDef {
	v := reflect.ValueOf(schema)
	t := v.Type()
	out := make([]FieldDef, 0, t.NumField())
	for i := 0; i < t.NumField(); i++ {
		sf := t.Field(i)
		fv := v.Field(i)

		k, ok := semanticKind(fv.Type())
		if !ok {
			continue
		}
		name := toSnake(sf.Name)
		def := FieldDef{Name: name, Kind: k}
		if tag := sf.Tag.Get("fookie"); tag != "" {
			applyTag(&def, tag)
		}
		out = append(out, def)
	}
	return out
}

func reflectValue(v any) reflect.Value {
	rv := reflect.ValueOf(v)
	if rv.Kind() != reflect.Ptr {
		return rv
	}
	return rv.Elem()
}

func toSnake(name string) string {
	var b strings.Builder
	for i, r := range name {
		if unicode.IsUpper(r) {
			if i > 0 {
				b.WriteByte('_')
			}
			b.WriteRune(unicode.ToLower(r))
			continue
		}
		b.WriteRune(r)
	}
	return b.String()
}
