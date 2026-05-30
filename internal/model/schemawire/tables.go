package schemawire

import (
	"github.com/fookiejs/fookie/internal/persistence/store"
	"github.com/fookiejs/fookie/semantic"
)

const sqlTypeText = "TEXT"

var kindSQL = map[Kind]string{
	semantic.StringKind:     sqlTypeText,
	semantic.Int64Kind:      "BIGINT",
	semantic.Float64Kind:    "DOUBLE PRECISION",
	semantic.BoolKind:       "BOOLEAN",
	semantic.IDKind:         sqlTypeText,
	semantic.CurrencyKind:   "BIGINT",
	semantic.EmailKind:      sqlTypeText,
	semantic.JSONKind:       "JSONB",
	semantic.EnumKind:       sqlTypeText,
	semantic.TimestampKind:  "TIMESTAMPTZ",
	semantic.DateKind:       "DATE",
	semantic.URLKind:        sqlTypeText,
	semantic.PhoneKind:      sqlTypeText,
	semantic.UUIDKind:       "UUID",
	semantic.ColorKind:      sqlTypeText,
	semantic.LocaleKind:     sqlTypeText,
	semantic.IBANKind:       sqlTypeText,
	semantic.IPKind:         "INET",
	semantic.CoordinateKind: "POINT",
}

func sqlTypeFor(k Kind) string {
	if t, ok := kindSQL[k]; ok {
		return t
	}
	return sqlTypeText
}

func TableFor(modelDefinition *StoredModel) store.Table {
	cols := make([]store.Column, 0, len(modelDefinition.Fields()))
	for _, field := range modelDefinition.Fields() {
		cols = append(cols, store.Column{
			Field:   field.Name,
			Name:    field.ColumnName(),
			SQLType: sqlTypeFor(field.Kind),
			Unique:  field.Unique,
			Indexed: field.Indexed,
			IsJSON:  field.Kind == semantic.JSONKind,
			IsID:    field.Name == "id",
		})
	}
	return store.Table{Name: modelDefinition.Name, Columns: cols}
}

func StoreTables(models []*StoredModel) []store.Table {
	tables := make([]store.Table, 0, len(models))
	for _, m := range models {
		tables = append(tables, TableFor(m))
	}
	return tables
}
