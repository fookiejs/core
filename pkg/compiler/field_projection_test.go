package compiler

import (
	"strings"
	"testing"

	"github.com/fookiejs/fookie/pkg/ast"
)

func TestBuildProjectionSubquery(t *testing.T) {
	m := &ast.Model{
		Name: "Account",
		Fields: []*ast.Field{
			{Name: "id", Type: ast.TypeUUID},
			{Name: "is_active", Type: ast.TypeBoolean},
		},
	}
	sg := NewSQLGenerator(&ast.Schema{Models: []*ast.Model{m}})
	fp := &FieldProjectionFilter{
		Model: "Account",
		Field: "id",
		Filter: map[string]interface{}{
			"is_active": map[string]interface{}{"eq": true},
		},
	}
	subq, args, _, err := sg.buildProjectionSubquery(fp, 1)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(subq, `SELECT "id" FROM "account"`) {
		t.Fatalf("subquery: %s", subq)
	}
	if !strings.Contains(subq, `"deleted_at" IS NULL`) {
		t.Fatalf("subquery missing deleted_at: %s", subq)
	}
	if len(args) != 1 {
		t.Fatalf("args: %v", args)
	}
}
