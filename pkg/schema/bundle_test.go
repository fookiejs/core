package schema

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/fookiejs/fookie/pkg/compiler"
	"github.com/stretchr/testify/require"
)

func TestBundleRoundTrip_Demo(t *testing.T) {
	orig, err := LoadBundle(filepath.Join("..", "..", "charts", "fookie", "files", "schema.bundle.json"))
	require.NoError(t, err)

	data, err := MarshalBundle(orig)
	require.NoError(t, err)

	loaded, err := LoadBundleBytes(data)
	require.NoError(t, err)

	require.Equal(t, len(orig.Models), len(loaded.Models))
	require.Equal(t, len(orig.Externals), len(loaded.Externals))
	require.Equal(t, len(orig.Modules), len(loaded.Modules))
	require.Equal(t, len(orig.Enums), len(loaded.Enums))
	require.Equal(t, len(orig.Configs), len(loaded.Configs))
	require.Equal(t, len(orig.Seeds), len(loaded.Seeds))
	require.Equal(t, len(orig.Crons), len(loaded.Crons))

	sqlOrig, err := compiler.NewSQLGenerator(orig).Generate()
	require.NoError(t, err)
	sqlLoaded, err := compiler.NewSQLGenerator(loaded).Generate()
	require.NoError(t, err)
	require.Equal(t, sqlOrig, sqlLoaded)
}

func TestLoadSchema_BundleDirectory(t *testing.T) {
	dir := t.TempDir()
	bundlePath := filepath.Join(dir, "schema.bundle.json")
	orig, err := LoadBundle(filepath.Join("..", "..", "charts", "fookie", "files", "schema.bundle.json"))
	require.NoError(t, err)
	data, err := MarshalBundle(orig)
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(bundlePath, data, 0644))

	s, err := LoadSchema(dir)
	require.NoError(t, err)
	require.Len(t, s.Models, len(orig.Models))
}
