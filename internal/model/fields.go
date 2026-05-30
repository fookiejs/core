package model

import (
	"strings"
	"unicode"
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
	var builder strings.Builder
	for _, p := range parts {
		if p == "" {
			continue
		}
		runes := []rune(p)
		runes[0] = unicode.ToUpper(runes[0])
		builder.WriteString(string(runes))
	}
	return builder.String()
}

func (m *StoredModel) ColumnForField(name string) string {
	for _, s := range m.snapshots {
		if s.Name == name {
			return s.ColumnName()
		}
	}
	return name
}

func (f FieldDef) KindValue() string { return string(f.Kind) }
