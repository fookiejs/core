package graphqlapi

import (
	"github.com/fookiejs/fookie/internal/model/schemawire"
	"github.com/graphql-go/graphql"
)

func buildFilterInputType(stored *schemawire.StoredModel) *graphql.InputObject {
	fields := make(graphql.InputObjectConfigFieldMap)
	for _, f := range stored.Fields() {
		if f.Name == "id" || f.RelationName != "" {
			continue
		}
		fields[f.Name] = &graphql.InputObjectFieldConfig{Type: GraphQLScalarFor(f)}
	}
	return graphql.NewInputObject(graphql.InputObjectConfig{
		Name:   stored.Name + "FilterInput",
		Fields: fields,
	})
}
