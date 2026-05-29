package model

import (
	"strings"
	"unicode"

	"github.com/fookiejs/fookie/internal/persistence/row"
)

func (f FieldDef) ColumnName() string {
	if f.RelationName != "" {
		return f.Name + "_id"
	}
	return f.Name
}

func (f FieldDef) GraphQLName() string {
	if f.RelationName != "" {
		return structFieldGraphQLSuffix(f.Name)
	}
	return f.Name
}

func RelationListGraphQLName(childModel string, fkField FieldDef, siblings int) string {
	if siblings <= 1 {
		return "ALL_" + childModel
	}
	return "ALL_" + childModel + "_" + structFieldGraphQLSuffix(fkField.Name)
}

func structFieldGraphQLSuffix(fieldName string) string {
	base := strings.TrimSuffix(fieldName, "_id")
	parts := strings.Split(base, "_")
	var b strings.Builder
	for _, p := range parts {
		if p == "" {
			continue
		}
		runes := []rune(p)
		runes[0] = unicode.ToUpper(runes[0])
		b.WriteString(string(runes))
	}
	return b.String()
}

func (m *StoredModel) ColumnForField(name string) string {
	for _, s := range m.snapshots {
		if s.Name == name {
			return s.ColumnName()
		}
	}
	return name
}

func RelationFKValue(data row.Map, f FieldDef) (row.Cell, bool) {
	if v, ok := data[f.Name]; ok && v.Kind != row.KindEmpty {
		return v, true
	}
	if v, ok := data[f.ColumnName()]; ok && v.Kind != row.KindEmpty {
		return v, true
	}
	return row.EmptyCell(), false
}

func (f FieldDef) KindValue() string { return string(f.Kind) }
