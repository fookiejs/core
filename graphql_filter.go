package fookie

import (
	"fmt"

	"github.com/graphql-go/graphql"
)

func buildFilterInputType(m *storedModel) *graphql.InputObject {
	fields := make(graphql.InputObjectConfigFieldMap)
	for _, f := range m.fields {
		if f.Name == "id" || f.RelationName != "" {
			continue
		}
		gqlType, ok := kindToGraphQL[f.Kind]
		if !ok {
			gqlType = graphql.String
		}
		fields[f.Name] = &graphql.InputObjectFieldConfig{Type: gqlType}
	}
	return graphql.NewInputObject(graphql.InputObjectConfig{
		Name:   m.name + "FilterInput",
		Fields: fields,
	})
}

func filtersFromGraphQL(model *storedModel, raw any) ([]queryFilter, error) {
	m, ok := raw.(map[string]any)
	if !ok || len(m) == 0 {
		return nil, nil
	}
	var out []queryFilter
	for _, f := range model.fields {
		if f.Name == "id" || f.RelationName != "" {
			continue
		}
		v, ok := m[f.Name]
		if !ok || v == nil {
			continue
		}
		out = append(out, queryFilter{
			field: model.columnForField(f.Name),
			op:    "=",
			value: v,
		})
	}
	return out, nil
}

func mergeFilters(base []queryFilter, extra ...queryFilter) []queryFilter {
	if len(extra) == 0 {
		return base
	}
	out := make([]queryFilter, 0, len(base)+len(extra))
	out = append(out, base...)
	out = append(out, extra...)
	return out
}

func (a *App) queryListNested(stored *storedModel, headers map[string]string, filters []queryFilter) ([]map[string]any, error) {
	qb := &queryBuilder{limit: 100}
	for _, f := range filters {
		qb.filters = append(qb.filters, f)
	}
	items, err := a.db.list(stored, qb)
	if err != nil {
		return nil, err
	}
	return items, nil
}

func (a *App) queryReadNormalized(stored *storedModel, headers map[string]string, id string) (map[string]any, error) {
	row, err := stored.runner.read(headers, id)
	if err != nil {
		return nil, err
	}
	return row, nil
}

func applyTopLevelFilters(stored *storedModel, filterArg any) ([]queryFilter, error) {
	filters, err := filtersFromGraphQL(stored, filterArg)
	if err != nil {
		return nil, fmt.Errorf("filter %s: %w", stored.name, err)
	}
	return filters, nil
}

func normalizeGraphQLInput(model *storedModel, input map[string]any) map[string]any {
	if input == nil {
		return input
	}
	out := make(map[string]any, len(input))
	for k, v := range input {
		out[k] = v
	}
	for _, f := range model.fields {
		if f.RelationName == "" {
			continue
		}
		if v, ok := out[f.GraphQLName()]; ok {
			out[f.Name] = v
			delete(out, f.GraphQLName())
		}
	}
	return out
}
