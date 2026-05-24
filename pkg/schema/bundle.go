package schema

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/fookiejs/fookie/pkg/ast"
)

const BundleVersion = 1

type bundleFile struct {
	Version int         `json:"bundleVersion"`
	Schema  *schemaWire `json:"schema"`
}

func MarshalBundle(s *ast.Schema) ([]byte, error) {
	if s == nil {
		return nil, fmt.Errorf("nil schema")
	}
	w := encodeSchema(s)
	out := bundleFile{Version: BundleVersion, Schema: w}
	return json.MarshalIndent(out, "", "  ")
}

func LoadBundle(path string) (*ast.Schema, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read bundle %q: %w", path, err)
	}
	return LoadBundleBytes(data)
}

func LoadBundleBytes(data []byte) (*ast.Schema, error) {
	var bf bundleFile
	if err := json.Unmarshal(data, &bf); err != nil {
		return nil, fmt.Errorf("decode bundle: %w", err)
	}
	if bf.Version != BundleVersion {
		return nil, fmt.Errorf("unsupported bundleVersion %d (want %d)", bf.Version, BundleVersion)
	}
	if bf.Schema == nil {
		return nil, fmt.Errorf("bundle missing schema")
	}
	s := decodeSchema(bf.Schema)
	resolveEnumTypes(s)
	applyConfigEnv(s)
	return s, nil
}

func LoadSchema(pathOrDir string) (*ast.Schema, error) {
	path := pathOrDir
	info, err := os.Stat(pathOrDir)
	if err != nil {
		return nil, fmt.Errorf("schema path %q: %w", pathOrDir, err)
	}
	if info.IsDir() {
		candidates := []string{
			filepath.Join(pathOrDir, "schema.bundle.json"),
			filepath.Join(pathOrDir, "bundle.json"),
		}
		var found string
		for _, c := range candidates {
			if st, e := os.Stat(c); e == nil && !st.IsDir() {
				found = c
				break
			}
		}
		if found == "" {
			return nil, fmt.Errorf("no schema.bundle.json in directory %q", pathOrDir)
		}
		path = found
	}
	if !strings.HasSuffix(strings.ToLower(path), ".json") {
		return nil, fmt.Errorf("schema path must be a .json bundle (got %q); run fookie compile", path)
	}
	return LoadBundle(path)
}
