package graphqlapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	httpapi "github.com/fookiejs/fookie/internal/api/http"
	"github.com/fookiejs/fookie/internal/model/schemawire"
	"github.com/fookiejs/fookie/internal/observability/telemetry"
	"github.com/fookiejs/fookie/internal/persistence/serde"
	"github.com/fookiejs/fookie/semantic"
	"github.com/graphql-go/graphql"
)

const graphqlFieldCursor = "cursor"

func BuildSchema(app App) (graphql.Schema, error) {
	app.WireRelations()
	models := app.Models()

	filterTypes := make(map[string]*graphql.InputObject, len(models))
	for _, stored := range models {
		filterTypes[stored.Name] = buildFilterInputType(stored)
	}

	objectTypes := make(map[string]*graphql.Object, len(models))
	for _, stored := range models {
		current := stored
		objectTypes[current.Name] = graphql.NewObject(graphql.ObjectConfig{
			Name: current.Name,
			Fields: graphql.FieldsThunk(func() graphql.Fields {
				return buildObjectFields(app, current, objectTypes, filterTypes)
			}),
		})
	}

	connectionTypes := buildConnectionTypes(models, objectTypes)
	queryFields, mutationFields := buildRootFields(app, models, objectTypes, connectionTypes, filterTypes)

	gqlSchema, err := graphql.NewSchema(graphql.SchemaConfig{
		Query: graphql.NewObject(graphql.ObjectConfig{
			Name:   "Query",
			Fields: queryFields,
		}),
		Mutation: graphql.NewObject(graphql.ObjectConfig{
			Name:   "Mutation",
			Fields: mutationFields,
		}),
	})
	if err != nil {
		return graphql.Schema{}, fmt.Errorf("graphql schema: %w", err)
	}
	return gqlSchema, nil
}

func buildConnectionTypes(models []*schemawire.StoredModel, objectTypes map[string]*graphql.Object) map[string]*graphql.Object {
	connectionTypes := make(map[string]*graphql.Object, len(models))
	for _, stored := range models {
		obj := objectTypes[stored.Name]
		connectionTypes[stored.Name] = graphql.NewObject(graphql.ObjectConfig{
			Name: stored.Name + "Connection",
			Fields: graphql.Fields{
				"items":  &graphql.Field{Type: graphql.NewList(obj)},
				graphqlFieldCursor: &graphql.Field{Type: graphql.String},
			},
		})
	}
	return connectionTypes
}

func buildRootFields(app App, models []*schemawire.StoredModel, objectTypes map[string]*graphql.Object, connectionTypes map[string]*graphql.Object, filterTypes map[string]*graphql.InputObject) (graphql.Fields, graphql.Fields) {
	queryFields := make(graphql.Fields, len(models)*2)
	mutationFields := make(graphql.Fields, len(models)*3)

	for _, stored := range models {
		stored := stored
		obj := objectTypes[stored.Name]
		filterType := filterTypes[stored.Name]

		queryFields[stored.Name+"_ID"] = &graphql.Field{
			Type: obj,
			Args: graphql.FieldConfigArgument{
				"id": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
			},
			Resolve: func(p graphql.ResolveParams) (any, error) {
				id, _ := p.Args["id"].(string)
				return app.Engine(stored.Name).Read(p.Context, graphqlHeaders(p), schemawire.ID(id))
			},
		}

		queryFields["ALL_"+stored.Name] = &graphql.Field{
			Type: connectionTypes[stored.Name],
			Args: graphql.FieldConfigArgument{
				graphqlFieldCursor: &graphql.ArgumentConfig{Type: graphql.String},
				"filter":           &graphql.ArgumentConfig{Type: filterType},
			},
			Resolve: func(p graphql.ResolveParams) (any, error) {
				cursor, _ := p.Args[graphqlFieldCursor].(string)
				filters := applyTopLevelFilters(stored, p.Args["filter"])
				items, next, err := app.Engine(stored.Name).List(p.Context, graphqlHeaders(p), cursor, filters)
				if err != nil {
					return nil, err
				}
				var nextCursor any
				if len(next) > 0 {
					nextCursor = next
				}
				return map[string]any{"items": items, graphqlFieldCursor: nextCursor}, nil
			},
		}

		inputType := buildInputType(stored)

		mutationFields["create"+stored.Name] = &graphql.Field{
			Type: obj,
			Args: graphql.FieldConfigArgument{
				"input": &graphql.ArgumentConfig{Type: graphql.NewNonNull(inputType)},
			},
			Resolve: func(p graphql.ResolveParams) (any, error) {
				input, _ := p.Args["input"].(map[string]any)
				res, err := app.Engine(stored.Name).Create(p.Context, graphqlHeaders(p), NormalizeGraphQLInput(stored, input))
				if err != nil {
					return nil, err
				}
				return recordFromOpResult(res), nil
			},
		}

		mutationFields["update"+stored.Name] = &graphql.Field{
			Type: obj,
			Args: graphql.FieldConfigArgument{
				"id":    &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
				"input": &graphql.ArgumentConfig{Type: graphql.NewNonNull(inputType)},
			},
			Resolve: func(p graphql.ResolveParams) (any, error) {
				id, _ := p.Args["id"].(string)
				input, _ := p.Args["input"].(map[string]any)
				res, err := app.Engine(stored.Name).Update(p.Context, graphqlHeaders(p), schemawire.ID(id), NormalizeGraphQLInput(stored, input))
				if err != nil {
					return nil, err
				}
				return recordFromOpResult(res), nil
			},
		}

		mutationFields["delete"+stored.Name] = &graphql.Field{
			Type: graphql.Boolean,
			Args: graphql.FieldConfigArgument{
				"id": &graphql.ArgumentConfig{Type: graphql.NewNonNull(graphql.String)},
			},
			Resolve: func(p graphql.ResolveParams) (any, error) {
				id, _ := p.Args["id"].(string)
				err := app.Engine(stored.Name).Delete(p.Context, graphqlHeaders(p), schemawire.ID(id))
				return err == nil, err
			},
		}
	}
	return queryFields, mutationFields
}

func HandleGraphQL(application App, w http.ResponseWriter, r *http.Request) {
	if application.GraphQLSchema() == nil {
		httpapi.WriteErr(w, 500, "graphql_not_ready", "schema not initialized")
		return
	}

	var params struct {
		Query         string         `json:"query"`
		Variables     map[string]any `json:"variables"`
		OperationName string         `json:"operationName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&params); err != nil {
		httpapi.WriteErr(w, 400, "invalid_body", err.Error())
		return
	}

	telemetry.GraphQLReceived(r.Context(), params.OperationName)
	start := time.Now()
	gqlCtx := context.WithValue(r.Context(), graphqlRequestKey{}, r)
	result := graphql.Do(graphql.Params{
		Schema:         *application.GraphQLSchema(),
		RequestString:  params.Query,
		VariableValues: params.Variables,
		OperationName:  params.OperationName,
		Context:        gqlCtx,
	})

	telemetry.GraphQLDuration(r.Context(), params.OperationName, msElapsed(start))
	if len(result.Errors) > 0 {
		telemetry.GraphQLFailed(r.Context(), params.OperationName)
	}
	httpapi.WriteJSON(w, 200, result)
}

func buildObjectFields(application App, stored *schemawire.StoredModel, objectTypes map[string]*graphql.Object, filterTypes map[string]*graphql.InputObject) graphql.Fields {
	fields := make(graphql.Fields, len(stored.Fields())+8)
	fields["id"] = idField()

	for _, field := range stored.Fields() {
		if field.Name == "id" {
			continue
		}
		if field.RelationName != "" {
			fieldCopy := field
			relType := objectTypes[field.RelationName]
			fields[field.GraphQLName()] = &graphql.Field{
				Type: relType,
				Resolve: func(params graphql.ResolveParams) (any, error) {
					record, ok := params.Source.(schemawire.Record)
					if !ok || fieldCopy.Relation == nil {
						return nil, nil
					}
					fk, ok := serde.FieldValue(record.Data, fieldCopy.Name)
					if !ok {
						return nil, nil
					}
					fkText, ok := fk.(string)
					if !ok || len(fkText) == 0 {
						return nil, nil
					}
					return application.Engine(fieldCopy.Relation.Name).Read(params.Context, graphqlHeaders(params), schemawire.ID(fkText))
				},
			}
			continue
		}
		fields[field.Name] = scalarField(field.Name, GraphQLScalarFor(field))
	}

	childRels := schemawire.ChildRelationsForParent(application.ChildRelations(), stored.Name)
	for _, childRel := range childRels {
		childRel := childRel
		childObj := objectTypes[childRel.ChildModel.Name]
		childFilter := filterTypes[childRel.ChildModel.Name]
		fieldName := schemawire.RelationListGraphQLName(childRel.ChildModel.Name, childRel.FKField, schemawire.CountChildRelationsToParent(childRels, childRel.ChildModel.Name))
		if _, exists := fields[fieldName]; exists {
			continue
		}
		fields[fieldName] = &graphql.Field{
			Type: graphql.NewList(childObj),
			Args: graphql.FieldConfigArgument{
				"filter": &graphql.ArgumentConfig{Type: childFilter},
			},
			Resolve: func(p graphql.ResolveParams) (any, error) {
				parent, ok := p.Source.(schemawire.Record)
				if !ok || len(parent.ID) == 0 {
					return []schemawire.Record{}, nil
				}
				filters := FiltersFromGraphQL(childRel.ChildModel, p.Args["filter"])
				filters = MergeFilters(filters, schemawire.ListFilter{
					Field: childRel.FKField.ColumnName(),
					Op:    "=",
					Value: semantic.FilterText(parent.ID.String()),
				})
				return application.QueryListNested(childRel.ChildModel, filters)
			},
		}
	}

	fields["_fookieStatus"] = statusField()
	fields["_fookieError"] = errorField()

	return fields
}

func scalarField(name string, gqlType *graphql.Scalar) *graphql.Field {
	fieldName := name
	return &graphql.Field{
		Type: gqlType,
		Resolve: func(p graphql.ResolveParams) (any, error) {
			record, ok := p.Source.(schemawire.Record)
			if !ok || record.Data == nil {
				return nil, nil
			}
			v, ok := serde.FieldValue(record.Data, fieldName)
			if !ok {
				return nil, nil
			}
			return v, nil
		},
	}
}

func idField() *graphql.Field {
	return &graphql.Field{
		Type: graphql.String,
		Resolve: func(p graphql.ResolveParams) (any, error) {
			record, ok := p.Source.(schemawire.Record)
			if !ok || len(record.ID) == 0 {
				return nil, nil
			}
			return record.ID.String(), nil
		},
	}
}

func statusField() *graphql.Field {
	return &graphql.Field{
		Type: graphql.String,
		Resolve: func(p graphql.ResolveParams) (any, error) {
			record, ok := p.Source.(schemawire.Record)
			if !ok || len(record.Status) == 0 {
				return nil, nil
			}
			return record.Status.String(), nil
		},
	}
}

func errorField() *graphql.Field {
	return &graphql.Field{
		Type: graphql.String,
		Resolve: func(p graphql.ResolveParams) (any, error) {
			record, ok := p.Source.(schemawire.Record)
			if !ok || len(record.Error) == 0 {
				return nil, nil
			}
			return record.Error, nil
		},
	}
}

func recordFromOpResult(res schemawire.OpResult) schemawire.Record {
	status := schemawire.EntityStatusActive
	if res.Pending {
		status = schemawire.EntityStatusPending
	}
	return schemawire.Record{ID: res.ID, Status: status}
}

func buildInputType(stored *schemawire.StoredModel) *graphql.InputObject {
	fields := make(graphql.InputObjectConfigFieldMap, len(stored.Fields()))
	for _, field := range stored.Fields() {
		if field.Name == "id" || isProtectedInputField(field.Name) {
			continue
		}
		name := field.Name
		if field.RelationName != "" {
			name = field.GraphQLName()
		}
		fields[name] = &graphql.InputObjectFieldConfig{Type: GraphQLScalarFor(field)}
	}
	return graphql.NewInputObject(graphql.InputObjectConfig{
		Name:   stored.Name + "Input",
		Fields: fields,
	})
}

func graphqlHeaders(p graphql.ResolveParams) map[string]string {
	if p.Context == nil {
		return map[string]string{}
	}
	req, ok := p.Context.Value(graphqlRequestKey{}).(*http.Request)
	if !ok || req == nil {
		return map[string]string{}
	}
	return httpapi.HeadersMap(req)
}

func msElapsed(start time.Time) float64 {
	return float64(time.Since(start).Microseconds()) / 1_000.0
}

type graphqlRequestKey struct{}
