package graphqlapi

import (
	"github.com/fookiejs/fookie/internal/model/schemawire"
	"github.com/fookiejs/fookie/internal/runtime"
	"github.com/graphql-go/graphql"
)

type App interface {
	WireRelations()
	Models() []*schemawire.StoredModel
	ChildRelations() map[string][]schemawire.ChildRelation
	GraphQLSchema() *graphql.Schema
	SetGraphQLSchema(s *graphql.Schema)
	Engine(name string) *runtime.Engine
	QueryListNested(stored *schemawire.StoredModel, filters []schemawire.ListFilter) ([]schemawire.Record, error)
}
