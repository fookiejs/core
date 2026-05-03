package schema

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"github.com/fookiejs/fookie/pkg/ast"
	"github.com/fookiejs/fookie/pkg/parser"
)

type parsedSchemaSource struct {
	path   string
	schema *ast.Schema
}

type includeFile struct {
	path string
	body string
}

var includeLinePattern = regexp.MustCompile(`^\s*include\s+["']([^"']+)["']\s*$`)

func LoadSchema(pathOrDir string) (*ast.Schema, error) {
	info, err := os.Stat(pathOrDir)
	if err != nil {
		return nil, fmt.Errorf("schema path %q: %w", pathOrDir, err)
	}

	if info.IsDir() {
		mainPath := filepath.Join(pathOrDir, "main.fql")
		mainInfo, mainErr := os.Stat(mainPath)
		if mainErr == nil && !mainInfo.IsDir() {
			return loadSchemaFromEntry(mainPath)
		}

		matches, err := filepath.Glob(filepath.Join(pathOrDir, "*.fql"))
		if err != nil {
			return nil, err
		}
		if len(matches) == 0 {
			return nil, fmt.Errorf("no *.fql files found in directory %q", pathOrDir)
		}
		sort.Strings(matches)
		return loadSchemaFromPaths(matches)
	}

	return loadSchemaFromEntry(pathOrDir)
}

func loadSchemaFromPaths(paths []string) (*ast.Schema, error) {
	parts := make([]parsedSchemaSource, 0, len(paths))
	for _, p := range paths {
		s, err := parseFile(p)
		if err != nil {
			return nil, fmt.Errorf("parse %q: %w", p, err)
		}
		parts = append(parts, parsedSchemaSource{
			path:   p,
			schema: s,
		})
	}
	return mergeSchemasStrict(parts)
}

func loadSchemaFromEntry(entryPath string) (*ast.Schema, error) {
	files, err := resolveIncludeFiles(entryPath)
	if err != nil {
		return nil, err
	}

	parts := make([]parsedSchemaSource, 0, len(files))
	for _, f := range files {
		s, err := parseContent(f.body)
		if err != nil {
			return nil, fmt.Errorf("parse %q: %w", f.path, err)
		}
		parts = append(parts, parsedSchemaSource{
			path:   f.path,
			schema: s,
		})
	}
	return mergeSchemasStrict(parts)
}

func resolveIncludeFiles(entryPath string) ([]includeFile, error) {
	absEntry, err := filepath.Abs(entryPath)
	if err != nil {
		return nil, fmt.Errorf("resolve schema entry %q: %w", entryPath, err)
	}

	visited := map[string]bool{}
	activeIdx := map[string]int{}
	stack := make([]string, 0)
	ordered := make([]includeFile, 0)

	var walk func(string) error
	walk = func(path string) error {
		cleanPath := filepath.Clean(path)
		if idx, ok := activeIdx[cleanPath]; ok {
			cycle := append([]string{}, stack[idx:]...)
			cycle = append(cycle, cleanPath)
			return fmt.Errorf("circular include: %s", strings.Join(cycle, " -> "))
		}
		if visited[cleanPath] {
			return nil
		}

		contentBytes, err := os.ReadFile(cleanPath)
		if err != nil {
			return fmt.Errorf("read %q: %w", cleanPath, err)
		}
		includes, body := extractIncludes(string(contentBytes))

		activeIdx[cleanPath] = len(stack)
		stack = append(stack, cleanPath)

		baseDir := filepath.Dir(cleanPath)
		for _, inc := range includes {
			nextPath := filepath.Clean(filepath.Join(baseDir, inc))
			nextInfo, statErr := os.Stat(nextPath)
			if statErr != nil {
				if os.IsNotExist(statErr) {
					return fmt.Errorf("missing include %q in %q", inc, cleanPath)
				}
				return fmt.Errorf("include %q in %q: %w", inc, cleanPath, statErr)
			}
			if nextInfo.IsDir() {
				return fmt.Errorf("include %q in %q points to a directory", inc, cleanPath)
			}
			if err := walk(nextPath); err != nil {
				return err
			}
		}

		stack = stack[:len(stack)-1]
		delete(activeIdx, cleanPath)
		visited[cleanPath] = true
		ordered = append(ordered, includeFile{
			path: cleanPath,
			body: body,
		})
		return nil
	}

	if err := walk(absEntry); err != nil {
		return nil, err
	}
	return ordered, nil
}

func extractIncludes(content string) ([]string, string) {
	lines := strings.Split(content, "\n")
	includes := make([]string, 0)
	bodyLines := make([]string, 0, len(lines))

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if match := includeLinePattern.FindStringSubmatch(trimmed); match != nil {
			includes = append(includes, match[1])
			continue
		}
		bodyLines = append(bodyLines, line)
	}

	return includes, strings.Join(bodyLines, "\n")
}

func parseFile(path string) (*ast.Schema, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	return parseContent(string(content))
}

func parseContent(content string) (*ast.Schema, error) {
	lex := parser.NewLexer(content)
	p := parser.NewParser(lex.Tokenize())
	return p.Parse()
}

func mergeSchemasStrict(parts []parsedSchemaSource) (*ast.Schema, error) {
	merged := &ast.Schema{}
	moduleByName := map[string]string{}
	modelByName := map[string]string{}
	externalByName := map[string]string{}
	enumByName := map[string]string{}
	configByKey := map[string]string{}
	cronByName := map[string]string{}

	for _, part := range parts {
		for _, en := range part.schema.Enums {
			if prev, exists := enumByName[en.Name]; exists {
				return nil, fmt.Errorf("duplicate enum %q in %q and %q", en.Name, prev, part.path)
			}
			enumByName[en.Name] = part.path
			merged.Enums = append(merged.Enums, en)
		}

		for _, mod := range part.schema.Modules {
			if prev, exists := moduleByName[mod.Name]; exists {
				return nil, fmt.Errorf("duplicate module %q in %q and %q", mod.Name, prev, part.path)
			}
			moduleByName[mod.Name] = part.path
			merged.Modules = append(merged.Modules, mod)
		}

		for _, model := range part.schema.Models {
			if prev, exists := modelByName[model.Name]; exists {
				return nil, fmt.Errorf("duplicate model %q in %q and %q", model.Name, prev, part.path)
			}
			modelByName[model.Name] = part.path
			merged.Models = append(merged.Models, model)
		}

		for _, ext := range part.schema.Externals {
			if prev, exists := externalByName[ext.Name]; exists {
				return nil, fmt.Errorf("duplicate external %q in %q and %q", ext.Name, prev, part.path)
			}
			externalByName[ext.Name] = part.path
			merged.Externals = append(merged.Externals, ext)
		}

		for _, cfg := range part.schema.Configs {
			if prev, exists := configByKey[cfg.Key]; exists {
				return nil, fmt.Errorf("duplicate config %q in %q and %q", cfg.Key, prev, part.path)
			}
			configByKey[cfg.Key] = part.path
			merged.Configs = append(merged.Configs, cfg)
		}

		merged.Seeds = append(merged.Seeds, part.schema.Seeds...)

		for _, cronBlock := range part.schema.Crons {
			for _, cronEntry := range cronBlock.Entries {
				if prev, exists := cronByName[cronEntry.Name]; exists {
					return nil, fmt.Errorf("duplicate cron %q in %q and %q", cronEntry.Name, prev, part.path)
				}
				cronByName[cronEntry.Name] = part.path
			}
			merged.Crons = append(merged.Crons, cronBlock)
		}
	}

	resolveEnumTypes(merged)
	return merged, nil
}

func resolveEnumTypes(schema *ast.Schema) {
	enumNames := map[string]bool{}
	for _, en := range schema.Enums {
		enumNames[en.Name] = true
	}
	for _, model := range schema.Models {
		for _, f := range model.Fields {
			if f.Type == ast.TypeRelation && f.Relation != nil && enumNames[*f.Relation] {
				name := *f.Relation
				f.Type = ast.TypeEnum
				f.EnumRef = &name
				f.Relation = nil
			}
		}
	}
}
