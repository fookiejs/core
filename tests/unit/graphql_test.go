package tests

import (
	"path/filepath"
	"runtime"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/fookiejs/fookie/pkg/ast"
	fookiegql "github.com/fookiejs/fookie/pkg/graphql"
	schemapkg "github.com/fookiejs/fookie/pkg/schema"
	"github.com/graphql-go/graphql"
)

func projectRoot() string {
	_, filename, _, _ := runtime.Caller(0)
	return filepath.Join(filepath.Dir(filename), "..", "..")
}

func loadDemoBundle(t *testing.T) *ast.Schema {
	t.Helper()
	path := filepath.Join(projectRoot(), "charts", "fookie", "files", "schema.bundle.json")
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

func TestGraphQL_BuildSchema_DemoBundle(t *testing.T) {
	schema := loadDemoBundle(t)
	gqlSchema, err := fookiegql.BuildSchema(schema, nil, nil)
	require.NoError(t, err)

	queryType := gqlSchema.QueryType()
	require.NotNil(t, queryType)
	queryFields := queryType.Fields()
	assert.Contains(t, queryFields, "list_account")
	assert.Contains(t, queryFields, "list_transaction")

	mutationType := gqlSchema.MutationType()
	require.NotNil(t, mutationType)
	mutFields := mutationType.Fields()
	assert.Contains(t, mutFields, "create_account")
	assert.Contains(t, mutFields, "create_transaction")
}

func TestGraphQL_Introspection(t *testing.T) {
	schema := loadDemoBundle(t)
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
