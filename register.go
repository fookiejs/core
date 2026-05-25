package fookie

import (
	"reflect"
	"strconv"
	"strings"
	"unicode"
)

const semanticPkg = "github.com/fookiejs/fookie/semantic"

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

func applyTag(def *FieldDef, tag string) {
	for _, part := range strings.Split(tag, ",") {
		part = strings.TrimSpace(part)
		switch {
		case part == "indexed":
			def.Indexed = true
		case part == "unique":
			def.Unique = true
		case strings.HasPrefix(part, "relation:"):
			def.RelationName = strings.TrimPrefix(part, "relation:")
		case strings.HasPrefix(part, "min="):
			if v, err := strconv.ParseInt(strings.TrimPrefix(part, "min="), 10, 64); err == nil {
				def.Min = &v
			}
		case strings.HasPrefix(part, "max="):
			if v, err := strconv.ParseInt(strings.TrimPrefix(part, "max="), 10, 64); err == nil {
				def.Max = &v
			}
		}
	}
}

func fieldsFromSchema(schema any) []FieldDef {
	return collectFields(reflect.ValueOf(schema))
}

func collectFields(v reflect.Value) []FieldDef {
	if v.Kind() == reflect.Pointer {
		v = v.Elem()
	}
	t := v.Type()
	out := make([]FieldDef, 0, t.NumField())
	for i := range t.NumField() {
		sf := t.Field(i)
		fv := v.Field(i)

		if sf.Anonymous && fv.Kind() == reflect.Struct {
			out = append(out, collectFields(fv)...)
			continue
		}

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

func toSnake(name string) string {
	runes := []rune(name)
	var b strings.Builder
	for i, r := range runes {
		if unicode.IsUpper(r) {
			if i > 0 {
				prev := runes[i-1]
				var next rune
				if i+1 < len(runes) {
					next = runes[i+1]
				}
				if unicode.IsLower(prev) || (unicode.IsUpper(prev) && next != 0 && unicode.IsLower(next)) {
					b.WriteByte('_')
				}
			}
			b.WriteRune(unicode.ToLower(r))
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}
