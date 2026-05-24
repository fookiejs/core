package tests

import (
	"path/filepath"
	"testing"

	schemapkg "github.com/fookiejs/fookie/pkg/schema"
	"github.com/stretchr/testify/require"
)

func TestDemoSchemaPlan_Parses(t *testing.T) {
	schemaPath := filepath.Join("..", "..", "testdata", "schema.bundle.json")
	schema, err := schemapkg.LoadBundle(schemaPath)
	require.NoError(t, err)

	require.GreaterOrEqual(t, len(schema.Models), 3, "demo should define core models")
	require.GreaterOrEqual(t, len(schema.Externals), 3, "demo should use externals to showcase the feature")
	require.NotEmpty(t, schema.Crons, "demo should have cron entries")
	require.NotEmpty(t, schema.Seeds, "demo should have seed data")
}
