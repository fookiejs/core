package fookie

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/graphql-go/graphql"
)

var kindToGraphQL = map[kind]*graphql.Scalar{
	stringKind:     graphql.String,
	emailKind:      graphql.String,
	urlKind:        graphql.String,
	phoneKind:      graphql.String,
	uuidKind:       graphql.String,
	colorKind:      graphql.String,
	localeKind:      graphql.String,
	ibanKind:       graphql.String,
	ipKind:         graphql.String,
	coordinateKind: graphql.String,
	enumKind:       graphql.String,
	idKind:         graphql.String,
	dateKind:       graphql.String,
	timestampKind:  graphql.String,
	jsonKind:       graphql.String,
	int64Kind:      graphql.Int,
	currencyKind:   graphql.Int,
	boolKind:       graphql.Boolean,
	float64Kind:    graphql.Float,
}

func (a *App) buildGraphQLSchema() (graphql.Schema, error) {
	a.wireRelations()

	filterTypes := make(map[string]*graphql.InputObject, len(a.models))
	for _, m := range a.models {
		filterTypes[m.name] = buildFilterInputType(m)
	}

	objectTypes := make(map[string]*graphql.Object, len(a.models))
	for _, m := range a.models {
		mm := m
		objectTypes[mm.name] = graphql.NewObject(graphql.ObjectConfig{
			Name: mm.name,
			Fields: graphql.FieldsThunk(func() graphql.Fields {
				return a.buildObjectFields(mm, objectTypes, filterTypes)
			}),
		})
	}

	queryFields := make(graphql.Fields, len(a.models)*2)
	mutationFields := make(graphql.Fields, len(a.models)*3)

	for _, m := range a.models {
		m := m
		obj := objectTypes[m.name]
		filterType := filterTypes[m.name]

		queryFields[m.name+"_ID"] = &graphql.Field{
			Type: obj,
			Args: graphql.FieldConfigArgument{
				"id": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
			},
			Resolve: func(p graphql.ResolveParams) (any, error) {
				id, _ := p.Args["id"].(string)
				return a.queryReadNormalized(m, graphqlHeaders(p), id)
			},
		}

		queryFields["ALL_"+m.name] = &graphql.Field{
			Type: graphql.NewList(obj),
			Args: graphql.FieldConfigArgument{
				"cursor": &graphql.ArgumentConfig{Type: graphql.String},
				"limit":  &graphql.ArgumentConfig{Type: graphql.Int},
				"filter": &graphql.ArgumentConfig{Type: filterType},
			},
			Resolve: func(p graphql.ResolveParams) (any, error) {
				cursor, _ := p.Args["cursor"].(string)
				limit, _ := p.Args["limit"].(int)
				filters, err := applyTopLevelFilters(m, p.Args["filter"])
				if err != nil {
					return nil, err
				}
				items, _, err := m.runner.list(graphqlHeaders(p), cursor, limit, filters)
				return items, err
			},
		}

		inputType := buildInputType(m)

		mutationFields["create"+m.name] = &graphql.Field{
			Type: obj,
			Args: graphql.FieldConfigArgument{
				"input": &graphql.ArgumentConfig{Type: graphql.NewNonNull(inputType)},
			},
			Resolve: func(p graphql.ResolveParams) (any, error) {
				input, _ := p.Args["input"].(map[string]any)
				return m.runner.create(graphqlHeaders(p), normalizeGraphQLInput(m, input))
			},
		}

		mutationFields["update"+m.name] = &graphql.Field{
			Type: obj,
			Args: graphql.FieldConfigArgument{
				"id":    &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
				"input": &graphql.ArgumentConfig{Type: graphql.NewNonNull(inputType)},
			},
			Resolve: func(p graphql.ResolveParams) (any, error) {
				id, _ := p.Args["id"].(string)
				input, _ := p.Args["input"].(map[string]any)
				return m.runner.update(graphqlHeaders(p), id, normalizeGraphQLInput(m, input))
			},
		}

		mutationFields["delete"+m.name] = &graphql.Field{
			Type: graphql.Boolean,
			Args: graphql.FieldConfigArgument{
				"id": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
			},
			Resolve: func(p graphql.ResolveParams) (any, error) {
				id, _ := p.Args["id"].(string)
				err := m.runner.delete(graphqlHeaders(p), id)
				return err == nil, err
			},
		}
	}

	return graphql.NewSchema(graphql.SchemaConfig{
		Query: graphql.NewObject(graphql.ObjectConfig{
			Name:   "Query",
			Fields: queryFields,
		}),
		Mutation: graphql.NewObject(graphql.ObjectConfig{
			Name:   "Mutation",
			Fields: mutationFields,
		}),
	})
}

func (a *App) buildObjectFields(m *storedModel, objectTypes map[string]*graphql.Object, filterTypes map[string]*graphql.InputObject) graphql.Fields {
	fields := make(graphql.Fields, len(m.fields)+8)
	fields["id"] = &graphql.Field{Type: graphql.String}

	for _, f := range m.fields {
		if f.Name == "id" {
			continue
		}
		if f.RelationName != "" {
			ff := f
			relType := objectTypes[f.RelationName]
			fields[f.GraphQLName()] = &graphql.Field{
				Type: relType,
				Resolve: func(p graphql.ResolveParams) (any, error) {
					row, ok := p.Source.(map[string]any)
					if !ok {
						return nil, nil
					}
					fk, ok := relationFKValue(row, ff)
					if !ok {
						return nil, nil
					}
					id, _ := fk.(string)
					if id == "" {
						return nil, nil
					}
					if ff.Relation == nil {
						return nil, nil
					}
					return a.queryReadNormalized(ff.Relation, graphqlHeaders(p), id)
				},
			}
			continue
		}
		gqlType, ok := kindToGraphQL[f.Kind]
		if !ok {
			gqlType = graphql.String
		}
		fields[f.Name] = &graphql.Field{Type: gqlType}
	}

	childRels := childRelationsToParent(a, m.name)
	for _, cr := range childRels {
		cr := cr
		childObj := objectTypes[cr.childModel.name]
		childFilter := filterTypes[cr.childModel.name]
		fieldName := relationListGraphQLName(cr.childModel.name, cr.fkField, countChildRelationsToParent(childRels, cr.childModel.name))
		if _, exists := fields[fieldName]; exists {
			continue
		}
		fields[fieldName] = &graphql.Field{
			Type: graphql.NewList(childObj),
			Args: graphql.FieldConfigArgument{
				"filter": &graphql.ArgumentConfig{Type: childFilter},
			},
			Resolve: func(p graphql.ResolveParams) (any, error) {
				parent, ok := p.Source.(map[string]any)
				if !ok {
					return nil, nil
				}
				parentID := parent["id"]
				if parentID == nil {
					return []map[string]any{}, nil
				}
				filters, err := filtersFromGraphQL(cr.childModel, p.Args["filter"])
				if err != nil {
					return nil, err
				}
				filters = mergeFilters(filters, queryFilter{
					field: cr.fkField.ColumnName(),
					op:    "=",
					value: parentID,
				})
				return a.queryListNested(cr.childModel, graphqlHeaders(p), filters)
			},
		}
	}

	fields["_fookieStatus"] = &graphql.Field{
		Type: graphql.String,
		Resolve: func(p graphql.ResolveParams) (any, error) {
			if row, ok := p.Source.(map[string]any); ok {
				return row["_fookie_status"], nil
			}
			return nil, nil
		},
	}
	fields["_fookieError"] = &graphql.Field{
		Type: graphql.String,
		Resolve: func(p graphql.ResolveParams) (any, error) {
			if row, ok := p.Source.(map[string]any); ok {
				return row["_fookie_error"], nil
			}
			return nil, nil
		},
	}
	return fields
}

func buildInputType(m *storedModel) *graphql.InputObject {
	fields := make(graphql.InputObjectConfigFieldMap, len(m.fields))
	for _, f := range m.fields {
		if f.Name == "id" {
			continue
		}
		gqlType, ok := kindToGraphQL[f.Kind]
		if !ok {
			gqlType = graphql.String
		}
		name := f.Name
		if f.RelationName != "" {
			name = f.GraphQLName()
		}
		fields[name] = &graphql.InputObjectFieldConfig{Type: gqlType}
	}
	return graphql.NewInputObject(graphql.InputObjectConfig{
		Name:   m.name + "Input",
		Fields: fields,
	})
}

func (a *App) handleGraphQL(w http.ResponseWriter, r *http.Request) {
	if a.graphqlSchema == nil {
		writeErr(w, 500, "graphql_not_ready", "schema not initialized")
		return
	}

	var params struct {
		Query         string         `json:"query"`
		Variables     map[string]any `json:"variables"`
		OperationName string         `json:"operationName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		writeErr(w, 400, "invalid_body", err.Error())
		return
	}

	emitGraphQLReceived(r.Context(), params.OperationName)
	start := time.Now()
	gqlCtx := context.WithValue(r.Context(), graphqlRequestKey{}, r)
	result := graphql.Do(graphql.Params{
		Schema:         *a.graphqlSchema,
		RequestString:  params.Query,
		VariableValues: params.Variables,
		OperationName:  params.OperationName,
		Context:        gqlCtx,
	})

	emitGraphQLDuration(r.Context(), params.OperationName, msElapsed(start), len(result.Errors) > 0)
	writeJSON(w, 200, result)
}

func graphqlHeaders(p graphql.ResolveParams) map[string]string {
	if p.Context == nil {
		return map[string]string{}
	}
	req, ok := p.Context.Value(graphqlRequestKey{}).(*http.Request)
	if !ok || req == nil {
		return map[string]string{}
	}
	return headersMap(req)
}

type graphqlRequestKey struct{}
