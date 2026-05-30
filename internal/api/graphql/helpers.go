package graphqlapi

import (
	"github.com/fookiejs/fookie/internal/model/schemawire"
	"github.com/fookiejs/fookie/internal/persistence/row"
	"github.com/fookiejs/fookie/internal/persistence/serde"
	"github.com/fookiejs/fookie/semantic"
	"github.com/graphql-go/graphql"
)

func GraphQLScalarFor(field schemawire.FieldDef) *graphql.Scalar {
	kindToGraphQL := map[semantic.Kind]*graphql.Scalar{
		semantic.StringKind:     graphql.String,
		semantic.EmailKind:      graphql.String,
		semantic.URLKind:        graphql.String,
		semantic.PhoneKind:      graphql.String,
		semantic.UUIDKind:       graphql.String,
		semantic.ColorKind:      graphql.String,
		semantic.LocaleKind:     graphql.String,
		semantic.IBANKind:       graphql.String,
		semantic.IPKind:         graphql.String,
		semantic.CoordinateKind: graphql.String,
		semantic.EnumKind:       graphql.String,
		semantic.IDKind:         graphql.String,
		semantic.DateKind:       graphql.String,
		semantic.TimestampKind:  graphql.String,
		semantic.JSONKind:       graphql.String,
		semantic.Int64Kind:      graphql.Int,
		semantic.CurrencyKind:   graphql.Int,
		semantic.BoolKind:       graphql.Boolean,
		semantic.Float64Kind:    graphql.Float,
	}
	if gqlType, ok := kindToGraphQL[field.Kind]; ok {
		return gqlType
	}
	return graphql.String
}

func FiltersFromGraphQL(stored *schemawire.StoredModel, raw any) []schemawire.ListFilter {
	dataMap, ok := raw.(map[string]any)
	if !ok || len(dataMap) == 0 {
		return nil
	}
	var out []schemawire.ListFilter
	for _, field := range stored.Fields() {
		if field.Name == "id" || field.RelationName != "" {
			continue
		}
		value, ok := dataMap[field.Name]
		if !ok || value == nil {
			continue
		}
		out = append(out, schemawire.ListFilter{
			Field: stored.ColumnForField(field.Name),
			Op:    "=",
			Value: row.FilterValueFromGraphQL(value),
		})
	}
	return out
}

func MergeFilters(base []schemawire.ListFilter, extra ...schemawire.ListFilter) []schemawire.ListFilter {
	if len(extra) == 0 {
		return base
	}
	out := make([]schemawire.ListFilter, 0, len(base)+len(extra))
	out = append(out, base...)
	out = append(out, extra...)
	return out
}

func NormalizeGraphQLInput(stored *schemawire.StoredModel, input map[string]any) row.Values {
	out := row.FromAnyMap(input)
	for _, field := range stored.Fields() {
		if field.RelationName == "" {
			continue
		}
		if cell, ok := out.Find(field.GraphQLName()); ok && cell.Kind != row.KindEmpty {
			out = out.Upsert(field.Name, cell)
			out = out.Remove(field.GraphQLName())
		}
	}
	return serde.FilterInputRow(out)
}

func isProtectedInputField(name string) bool {
	return serde.IsProtectedBaseColumn(name)
}

func applyTopLevelFilters(stored *schemawire.StoredModel, filterArg any) []schemawire.ListFilter {
	return FiltersFromGraphQL(stored, filterArg)
}
