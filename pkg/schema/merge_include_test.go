package schema

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func writeFQLFile(t *testing.T, root, rel, content string) string {
	t.Helper()
	full := filepath.Join(root, rel)
	require.NoError(t, os.MkdirAll(filepath.Dir(full), 0o755))
	require.NoError(t, os.WriteFile(full, []byte(content), 0o644))
	return full
}

func TestLoadSchema_IncludeGraphLoadsInOrder(t *testing.T) {
	dir := t.TempDir()
	mainPath := writeFQLFile(t, dir, "main.fql", `include "./modules/jwt_guard.fql"
include "./models/person.fql"
include "./seed/base.fql"
include "./cron/tick.fql"
`)
	writeFQLFile(t, dir, "modules/jwt_guard.fql", `module JwtGuard {
  before {}
}
`)
	writeFQLFile(t, dir, "models/person.fql", `model Person {
  fields { name: string }
  read {}
}
`)
	writeFQLFile(t, dir, "seed/base.fql", `seed {
  Person(name) {
    { name: "Aldric" }
  }
}
`)
	writeFQLFile(t, dir, "cron/tick.fql", `cron {
  world_tick("*/5 * * * * *") {}
}
`)

	schema, err := LoadSchema(mainPath)
	require.NoError(t, err)
	require.Len(t, schema.Modules, 1)
	require.Equal(t, "JwtGuard", schema.Modules[0].Name)
	require.Len(t, schema.Models, 1)
	require.Equal(t, "Person", schema.Models[0].Name)
	require.Len(t, schema.Seeds, 1)
	require.Len(t, schema.Crons, 1)
	require.Len(t, schema.Crons[0].Entries, 1)
	require.Equal(t, "world_tick", schema.Crons[0].Entries[0].Name)
}

func TestLoadSchema_DuplicateModelReturnsError(t *testing.T) {
	dir := t.TempDir()
	mainPath := writeFQLFile(t, dir, "main.fql", `include "./a.fql"
include "./b.fql"
`)
	writeFQLFile(t, dir, "a.fql", `model Person { fields { name: string } read {} }`)
	writeFQLFile(t, dir, "b.fql", `model Person { fields { name: string } read {} }`)

	_, err := LoadSchema(mainPath)
	require.Error(t, err)
	require.ErrorContains(t, err, `duplicate model "Person"`)
}

func TestLoadSchema_DuplicateModuleReturnsError(t *testing.T) {
	dir := t.TempDir()
	mainPath := writeFQLFile(t, dir, "main.fql", `include "./a.fql"
include "./b.fql"
`)
	writeFQLFile(t, dir, "a.fql", `module JwtGuard { before {} }`)
	writeFQLFile(t, dir, "b.fql", `module JwtGuard { before {} }`)

	_, err := LoadSchema(mainPath)
	require.Error(t, err)
	require.ErrorContains(t, err, `duplicate module "JwtGuard"`)
}

func TestLoadSchema_MissingIncludeReturnsError(t *testing.T) {
	dir := t.TempDir()
	mainPath := writeFQLFile(t, dir, "main.fql", `include "./missing.fql"
`)

	_, err := LoadSchema(mainPath)
	require.Error(t, err)
	require.ErrorContains(t, err, `missing include "./missing.fql"`)
}

func TestLoadSchema_CircularIncludeReturnsError(t *testing.T) {
	dir := t.TempDir()
	entry := writeFQLFile(t, dir, "a.fql", `include "./b.fql"
`)
	writeFQLFile(t, dir, "b.fql", `include "./a.fql"
`)

	_, err := LoadSchema(entry)
	require.Error(t, err)
	require.ErrorContains(t, err, "circular include:")
}

func TestLoadSchema_DirectoryMainEntryIsPreferred(t *testing.T) {
	dir := t.TempDir()
	writeFQLFile(t, dir, "main.fql", `include "./models/person.fql"
`)
	writeFQLFile(t, dir, "models/person.fql", `model Person { fields { name: string } read {} }`)
	writeFQLFile(t, dir, "z_extra.fql", `model Duplicate { fields { name: string } read {} }`)

	schema, err := LoadSchema(dir)
	require.NoError(t, err)
	require.Len(t, schema.Models, 1)
	require.Equal(t, "Person", schema.Models[0].Name)
}
