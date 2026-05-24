package compiler

import (
	"fmt"
	"strings"

	"github.com/fookiejs/fookie/pkg/ast"
)

type FieldProjectionFilter struct {
	Model  string
	Field  string
	Filter map[string]interface{}
}

func (sg *SQLGenerator) modelByName(name string) *ast.Model {
	if sg.schema == nil {
		return nil
	}
	for _, m := range sg.schema.Models {
		if m != nil && m.Name == name {
			return m
		}
	}
	return nil
}

func (sg *SQLGenerator) buildProjectionSubquery(fp *FieldProjectionFilter, paramStart int) (string, []interface{}, int, error) {
	model := sg.modelByName(fp.Model)
	if model == nil {
		return "", nil, paramStart, fmt.Errorf("unknown model %q for field projection", fp.Model)
	}
	col, _, ok := sg.fieldMeta(model, fp.Field)
	if !ok {
		return "", nil, paramStart, fmt.Errorf("unknown projection field %q on model %q", fp.Field, fp.Model)
	}
	table := SnakeCase(fp.Model)
	parts := []string{`"deleted_at" IS NULL`}
	args := []interface{}{}
	idx := paramStart
	if len(fp.Filter) > 0 {
		frag, fArgs, next, err := sg.BuildWhereClause(model, fp.Filter, idx)
		if err != nil {
			return "", nil, paramStart, err
		}
		idx = next
		if frag != "" {
			parts = append(parts, "("+frag+")")
			args = append(args, fArgs...)
		}
	}
	where := strings.Join(parts, " AND ")
	subq := fmt.Sprintf(`(SELECT %q FROM %q WHERE %s)`, col, table, where)
	return subq, args, idx, nil
}
