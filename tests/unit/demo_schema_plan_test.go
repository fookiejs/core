package tests

import (
	"path/filepath"
	"testing"

	schemapkg "github.com/fookiejs/fookie/pkg/schema"
	"github.com/stretchr/testify/require"
)

func TestDemoSchemaPlan_ParsesWithNoExternals(t *testing.T) {
	schemaPath := filepath.Join("..", "..", "..", "demo", "schema")
	schema, err := schemapkg.LoadSchema(schemaPath)
	require.NoError(t, err)

	require.GreaterOrEqual(t, len(schema.Models), 6, "demo should define core models for the sample UI")
	require.Len(t, schema.Externals, 0, "demo plan must stay FQL-only without externals")
	require.NotEmpty(t, schema.Crons, "simulation cadence should be represented by cron entries")
}
