package tests

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/fookiejs/fookie/pkg/ast"
	"github.com/fookiejs/fookie/pkg/events"
	fookiegql "github.com/fookiejs/fookie/pkg/graphql"
	schemapkg "github.com/fookiejs/fookie/pkg/schema"
	"github.com/graphql-go/graphql"
)

func loadDemoSchema(t *testing.T) *ast.Schema {
	t.Helper()
	path := filepath.Join("..", "..", "..", "demo", "schema", "schema.bundle.json")
	schema, err := schemapkg.LoadBundle(path)
	require.NoError(t, err)
	return schema
}

func TestGraphQL_TypeMapping(t *testing.T) {
	cases := []struct {
		fslType ast.FieldType
		gqlType graphql.Output
	}{
		{ast.TypeString, graphql.String},
		{ast.TypeNumber, graphql.Float},
		{ast.TypeBoolean, graphql.Boolean},
		{ast.TypeID, graphql.ID},
		{ast.TypeRelation, graphql.ID},
		{ast.TypeEmail, graphql.String},
		{ast.TypeURL, graphql.String},
		{ast.TypePhone, graphql.String},
		{ast.TypeUUID, graphql.String},
		{ast.TypeIBAN, graphql.String},
		{ast.TypeIPAddress, graphql.String},
		{ast.TypeColor, graphql.String},
		{ast.TypeCurrency, graphql.String},
		{ast.TypeLocale, graphql.String},
		{ast.TypeDate, graphql.String},
		{ast.TypeTimestamp, graphql.String},
		{ast.TypeJSON, graphql.String},
		{ast.TypeCoordinate, graphql.String},
	}

	for _, tc := range cases {
		t.Run(string(tc.fslType), func(t *testing.T) {
			result := fookiegql.MapFieldType(tc.fslType)
			assert.Equal(t, tc.gqlType, result)
		})
	}
}

func TestGraphQL_BuildSchema_CoreModels(t *testing.T) {
	schema := loadDemoSchema(t)
	gqlSchema, err := fookiegql.BuildSchema(schema, nil, nil)
	require.NoError(t, err)

	queryFields := gqlSchema.QueryType().Fields()
	assert.Contains(t, queryFields, "all_account")
	assert.Contains(t, queryFields, "all_transaction")

	mutFields := gqlSchema.MutationType().Fields()
	assert.Contains(t, mutFields, "create_account")
	assert.Contains(t, mutFields, "create_transaction")
	assert.Contains(t, mutFields, "update_account")
	assert.Contains(t, mutFields, "delete_account")
}

func TestGraphQL_FilterArg(t *testing.T) {
	schema := loadDemoSchema(t)
	gqlSchema, err := fookiegql.BuildSchema(schema, nil, nil)
	require.NoError(t, err)

	queryFields := gqlSchema.QueryType().Fields()
	for _, name := range []string{"all_account", "all_transaction"} {
		field, ok := queryFields[name]
		require.True(t, ok, "query field %s not found", name)
		hasFilter := false
		for _, a := range field.Args {
			if a.Name() == "filter" {
				hasFilter = true
				break
			}
		}
		assert.True(t, hasFilter, "%s should accept optional filter argument", name)
	}
}

func TestGraphQL_Introspection(t *testing.T) {
	schema := loadDemoSchema(t)
	gqlSchema, err := fookiegql.BuildSchema(schema, nil, nil)
	require.NoError(t, err)

	result := graphql.Do(graphql.Params{
		Schema:        gqlSchema,
		RequestString: `{ __schema { queryType { name } mutationType { name } } }`,
	})
	require.Empty(t, result.Errors)

	data := result.Data.(map[string]interface{})
	schemaData := data["__schema"].(map[string]interface{})
	assert.Equal(t, "Query", schemaData["queryType"].(map[string]interface{})["name"])
	assert.Equal(t, "Mutation", schemaData["mutationType"].(map[string]interface{})["name"])
}

func TestGraphQL_EntityEvents_subscription(t *testing.T) {
	schema := loadDemoSchema(t)
	eb := events.NewBus()
	gqlSchema, err := fookiegql.BuildSchema(schema, eb, nil)
	require.NoError(t, err)

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	go func() {
		time.Sleep(40 * time.Millisecond)
		eb.PublishCRUD("created", "Account", "id-1", map[string]interface{}{"x": 1})
	}()

	ch := graphql.Subscribe(graphql.Params{
		Context:       ctx,
		Schema:        gqlSchema,
		RequestString: `subscription { entity_events(model: "Account") { op model id ts } }`,
	})
	var saw bool
	for res := range ch {
		require.Empty(t, res.Errors, "%+v", res.Errors)
		if res.Data != nil {
			saw = true
			break
		}
	}
	require.True(t, saw)
}
