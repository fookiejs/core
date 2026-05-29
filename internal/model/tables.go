package model

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

func TableFor(m *StoredModel) store.Table {
	cols := make([]store.Column, 0, len(m.Fields()))
	for _, f := range m.Fields() {
		cols = append(cols, store.Column{
			Field:   f.Name,
			Name:    f.ColumnName(),
			SQLType: sqlTypeFor(f.Kind),
			Unique:  f.Unique,
			Indexed: f.Indexed,
			IsJSON:  f.Kind == semantic.JSONKind,
			IsID:    f.Name == "id",
		})
	}
	return store.Table{Name: m.Name, Columns: cols}
}

func StoreTables(models []*StoredModel) []store.Table {
	tables := make([]store.Table, 0, len(models))
	for _, m := range models {
		tables = append(tables, TableFor(m))
	}
	return tables
}
