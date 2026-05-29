package graphqlapi

import (
	"github.com/fookiejs/fookie/internal/model"
	"github.com/fookiejs/fookie/internal/runtime"
	"github.com/graphql-go/graphql"
)

type App interface {
	WireRelations()
	Models() []*model.StoredModel
	ChildRelations() map[string][]model.ChildRelation
	GraphQLSchema() *graphql.Schema
	SetGraphQLSchema(s *graphql.Schema)
	Engine(name string) *runtime.Engine
	QueryListNested(stored *model.StoredModel, filters []model.ListFilter) ([]model.Record, error)
}
