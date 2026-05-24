package fookie

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/graphql-go/graphql"
)

var kindToGraphQL = map[kind]*graphql.Scalar{
	stringKind:     graphql.String,
	emailKind:      graphql.String,
	urlKind:        graphql.String,
	phoneKind:      graphql.String,
	uuidKind:       graphql.String,
	colorKind:      graphql.String,
	localeKind:     graphql.String,
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
	objectTypes := make(map[string]*graphql.Object, len(a.models))
	for _, m := range a.models {
		objectTypes[m.name] = buildObjectType(m)
	}

	queryFields := make(graphql.Fields, len(a.models)*2)
	mutationFields := make(graphql.Fields, len(a.models)*3)

	for _, m := range a.models {
		m := m
		obj := objectTypes[m.name]
		lowerName := strings.ToLower(m.name[:1]) + m.name[1:]

		queryFields[lowerName] = &graphql.Field{
			Type: obj,
			Args: graphql.FieldConfigArgument{
				"id": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
			},
			Resolve: func(p graphql.ResolveParams) (any, error) {
				id, _ := p.Args["id"].(string)
				headers := graphqlHeaders(p)
				return m.runner.read(headers, id)
			},
		}

		queryFields[lowerName+"s"] = &graphql.Field{
			Type: graphql.NewList(obj),
			Args: graphql.FieldConfigArgument{
				"cursor": &graphql.ArgumentConfig{Type: graphql.String},
				"limit":  &graphql.ArgumentConfig{Type: graphql.Int},
			},
			Resolve: func(p graphql.ResolveParams) (any, error) {
				cursor, _ := p.Args["cursor"].(string)
				limit, _ := p.Args["limit"].(int)
				headers := graphqlHeaders(p)
				items, _, err := m.runner.list(headers, cursor, limit)
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
				headers := graphqlHeaders(p)
				return m.runner.create(headers, input)
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
				headers := graphqlHeaders(p)
				return m.runner.update(headers, id, input)
			},
		}

		mutationFields["delete"+m.name] = &graphql.Field{
			Type: graphql.Boolean,
			Args: graphql.FieldConfigArgument{
				"id": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
			},
			Resolve: func(p graphql.ResolveParams) (any, error) {
				id, _ := p.Args["id"].(string)
				headers := graphqlHeaders(p)
				err := m.runner.delete(headers, id)
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

func buildObjectType(m *storedModel) *graphql.Object {
	fields := make(graphql.Fields, len(m.fields)+1)
	fields["id"] = &graphql.Field{Type: graphql.String}
	for _, f := range m.fields {
		if f.Name == "id" {
			continue
		}
		gqlType, ok := kindToGraphQL[f.Kind]
		if !ok {
			gqlType = graphql.String
		}
		fname := f.Name
		fields[fname] = &graphql.Field{Type: gqlType}
	}
	return graphql.NewObject(graphql.ObjectConfig{
		Name:   m.name,
		Fields: fields,
	})
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
		fields[f.Name] = &graphql.InputObjectFieldConfig{Type: gqlType}
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

	result := graphql.Do(graphql.Params{
		Schema:         *a.graphqlSchema,
		RequestString:  params.Query,
		VariableValues: params.Variables,
		OperationName:  params.OperationName,
		Context:        r.Context(),
	})

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
