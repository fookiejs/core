package graphqlapi

import (
	"github.com/fookiejs/fookie/internal/model"
	"github.com/fookiejs/fookie/internal/persistence/row"
	"github.com/fookiejs/fookie/internal/persistence/serde"
	"github.com/fookiejs/fookie/semantic"
	"github.com/graphql-go/graphql"
)

func GraphQLScalarFor(field model.FieldDef) *graphql.Scalar {
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

func FiltersFromGraphQL(stored *model.StoredModel, raw any) []model.ListFilter {
	dataMap, ok := raw.(map[string]any)
	if !ok || len(dataMap) == 0 {
		return nil
	}
	var out []model.ListFilter
	for _, field := range stored.Fields() {
		if field.Name == "id" || field.RelationName != "" {
			continue
		}
		value, ok := dataMap[field.Name]
		if !ok || value == nil {
			continue
		}
		out = append(out, model.ListFilter{
			Field: stored.ColumnForField(field.Name),
			Op:    "=",
			Value: row.FilterValueFromGraphQL(value),
		})
	}
	return out
}

func MergeFilters(base []model.ListFilter, extra ...model.ListFilter) []model.ListFilter {
	if len(extra) == 0 {
		return base
	}
	out := make([]model.ListFilter, 0, len(base)+len(extra))
	out = append(out, base...)
	out = append(out, extra...)
	return out
}

func NormalizeGraphQLInput(stored *model.StoredModel, input map[string]any) row.Values {
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

func applyTopLevelFilters(stored *model.StoredModel, filterArg any) []model.ListFilter {
	return FiltersFromGraphQL(stored, filterArg)
}
