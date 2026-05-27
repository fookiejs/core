package fookie

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
		return f.RelationName
	}
	return f.Name
}

func relationListGraphQLName(childModel string, fkField FieldDef, siblings int) string {
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

func (m *storedModel) columnForField(name string) string {
	for _, f := range m.fields {
		if f.Name == name {
			return f.ColumnName()
		}
	}
	return name
}

func normalizeRow(model *storedModel, row map[string]any) map[string]any {
	if row == nil {
		return row
	}
	for _, f := range model.fields {
		col := f.ColumnName()
		if col == f.Name {
			continue
		}
		if v, ok := row[col]; ok {
			row[f.Name] = v
		}
	}
	return row
}

func normalizeRows(model *storedModel, rows []map[string]any) []map[string]any {
	for i := range rows {
		rows[i] = normalizeRow(model, rows[i])
	}
	return rows
}

func relationFKValue(row map[string]any, f FieldDef) (any, bool) {
	if v, ok := row[f.Name]; ok && v != nil {
		return v, true
	}
	if v, ok := row[f.ColumnName()]; ok && v != nil {
		return v, true
	}
	return nil, false
}
