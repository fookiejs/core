package runtime

import (
	"context"
	"testing"

	"github.com/fookiejs/fookie/pkg/ast"
	"github.com/stretchr/testify/require"
)

func assignmentStmt(name string, value interface{}) ast.Statement {
	return &ast.Assignment{Name: name, Value: &ast.Literal{Value: value}}
}

func assignmentNames(block *ast.Block) []string {
	if block == nil {
		return nil
	}
	out := make([]string, 0, len(block.Statements))
	for _, stmt := range block.Statements {
		assign, ok := stmt.(*ast.Assignment)
		if !ok {
			continue
		}
		out = append(out, assign.Name)
	}
	return out
}

func TestResolveOpInjectsUseBlocksPerPhaseInOrder(t *testing.T) {
	op := &ast.Operation{
		Type:       "update",
		Role:       &ast.Block{Statements: []ast.Statement{assignmentStmt("op_role", "r")}},
		Rule:       &ast.Block{Statements: []ast.Statement{assignmentStmt("op_rule", "r")}},
		Modify:     &ast.Block{Statements: []ast.Statement{assignmentStmt("op_modify", "m")}},
		Effect:     &ast.Block{Statements: []ast.Statement{assignmentStmt("op_effect", "e")}},
		Compensate: &ast.Block{Statements: []ast.Statement{assignmentStmt("op_compensate", "c")}},
	}
	model := &ast.Model{
		Name: "Person",
		Uses: []string{"GuardA", "GuardB"},
		CRUD: map[string]*ast.Operation{"update": op},
	}
	schema := &ast.Schema{
		Models: []*ast.Model{model},
		Modules: []*ast.Module{
			{
				Name:       "GuardA",
				Role:       &ast.Block{Statements: []ast.Statement{assignmentStmt("a_role", "r")}},
				Rule:       &ast.Block{Statements: []ast.Statement{assignmentStmt("a_rule", "r")}},
				Modify:     &ast.Block{Statements: []ast.Statement{assignmentStmt("a_modify", "m")}},
				Effect:     &ast.Block{Statements: []ast.Statement{assignmentStmt("a_effect", "e")}},
				Compensate: &ast.Block{Statements: []ast.Statement{assignmentStmt("a_compensate", "c")}},
			},
			{
				Name:       "GuardB",
				Role:       &ast.Block{Statements: []ast.Statement{assignmentStmt("b_role", "r")}},
				Rule:       &ast.Block{Statements: []ast.Statement{assignmentStmt("b_rule", "r")}},
				Modify:     &ast.Block{Statements: []ast.Statement{assignmentStmt("b_modify", "m")}},
				Effect:     &ast.Block{Statements: []ast.Statement{assignmentStmt("b_effect", "e")}},
				Compensate: &ast.Block{Statements: []ast.Statement{assignmentStmt("b_compensate", "c")}},
			},
		},
	}
	exec := NewExecutor(nil, schema, nil)

	injectedOp, _, err := exec.resolveOp("Person", "update")
	require.NoError(t, err)
	require.Equal(t, []string{"a_role", "b_role", "op_role"}, assignmentNames(injectedOp.Role))
	require.Equal(t, []string{"a_rule", "b_rule", "op_rule"}, assignmentNames(injectedOp.Rule))
	require.Equal(t, []string{"a_modify", "b_modify", "op_modify"}, assignmentNames(injectedOp.Modify))
	require.Equal(t, []string{"a_effect", "b_effect", "op_effect"}, assignmentNames(injectedOp.Effect))
	require.Equal(t, []string{"a_compensate", "b_compensate", "op_compensate"}, assignmentNames(injectedOp.Compensate))
}

func TestResolveOpDoesNotMixBlockTypes(t *testing.T) {
	op := &ast.Operation{
		Type: "read",
		Role: &ast.Block{Statements: []ast.Statement{assignmentStmt("op_role", "r")}},
	}
	model := &ast.Model{
		Name: "Person",
		Uses: []string{"EffectOnly"},
		CRUD: map[string]*ast.Operation{"read": op},
	}
	schema := &ast.Schema{
		Models: []*ast.Model{model},
		Modules: []*ast.Module{
			{
				Name:   "EffectOnly",
				Effect: &ast.Block{Statements: []ast.Statement{assignmentStmt("module_effect", "e")}},
			},
		},
	}
	exec := NewExecutor(nil, schema, nil)

	injectedOp, _, err := exec.resolveOp("Person", "read")
	require.NoError(t, err)
	require.Equal(t, []string{"op_role"}, assignmentNames(injectedOp.Role))
	require.Equal(t, []string{"module_effect"}, assignmentNames(injectedOp.Effect))
}

func TestUseRuleDenyStopsModelRuleExecution(t *testing.T) {
	op := &ast.Operation{
		Type: "read",
		Rule: &ast.Block{Statements: []ast.Statement{
			assignmentStmt("model_rule_ran", true),
		}},
	}
	model := &ast.Model{
		Name: "Person",
		Uses: []string{"DenyRule"},
		CRUD: map[string]*ast.Operation{"read": op},
	}
	schema := &ast.Schema{
		Models: []*ast.Model{model},
		Modules: []*ast.Module{
			{
				Name: "DenyRule",
				Rule: &ast.Block{Statements: []ast.Statement{
					&ast.PredicateExpr{Expr: &ast.Literal{Value: false}},
				}},
			},
		},
	}
	exec := NewExecutor(nil, schema, nil)

	injectedOp, _, err := exec.resolveOp("Person", "read")
	require.NoError(t, err)
	rc := newRunCtx(map[string]interface{}{})
	err = exec.execBlock(context.Background(), "rule", injectedOp.Rule, rc)
	require.Error(t, err)
	_, ok := rc.vars["model_rule_ran"]
	require.False(t, ok)
}

func TestResolveOpErrorsForUnknownOrDuplicateUse(t *testing.T) {
	modelUnknown := &ast.Model{
		Name: "Person",
		Uses: []string{"MissingModule"},
		CRUD: map[string]*ast.Operation{"read": {Type: "read"}},
	}
	execUnknown := NewExecutor(nil, &ast.Schema{Models: []*ast.Model{modelUnknown}}, nil)
	_, _, err := execUnknown.resolveOp("Person", "read")
	require.Error(t, err)
	require.Contains(t, err.Error(), "uses unknown module")

	modelDuplicate := &ast.Model{
		Name: "Person",
		Uses: []string{"GuardA", "GuardA"},
		CRUD: map[string]*ast.Operation{"read": {Type: "read"}},
	}
	execDuplicate := NewExecutor(nil, &ast.Schema{
		Models: []*ast.Model{modelDuplicate},
		Modules: []*ast.Module{
			{Name: "GuardA"},
		},
	}, nil)
	_, _, err = execDuplicate.resolveOp("Person", "read")
	require.Error(t, err)
	require.Contains(t, err.Error(), "more than once")
}
