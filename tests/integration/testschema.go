package integration

import (
	"github.com/fookiejs/fookie/pkg/ast"
)

func fa(obj string, fields ...string) ast.Expression {
	return ast.FieldAccess{Object: obj, Fields: fields}
}

func lit(v interface{}) ast.Expression {
	return ast.Literal{Value: v}
}

func bin(left ast.Expression, op string, right ast.Expression) ast.Expression {
	return ast.BinaryOp{Left: left, Op: op, Right: right}
}

func counterSimpleSchema() *ast.Schema {
	updateBefore := &ast.Block{
		Statements: []ast.Statement{
			&ast.PredicateExpr{Expr: bin(fa("body", "delta"), "!=", lit(nil))},
			&ast.Assignment{Name: "n", Value: bin(fa("output", "n"), "+", fa("body", "delta"))},
		},
	}
	createBefore := &ast.Block{
		Statements: []ast.Statement{
			&ast.PredicateExpr{Expr: bin(fa("body", "n"), ">=", lit(0.0))},
			&ast.Assignment{Name: "n", Value: fa("body", "n")},
		},
	}
	return &ast.Schema{
		Models: []*ast.Model{{
			Name: "Counter",
			Fields: []*ast.Field{{
				Name: "n",
				Type: ast.TypeNumber,
			}},
			CRUD: map[string]*ast.Operation{
				"create": {
					Type:         "create",
					BeforeParams: []string{"body"},
					Before:       createBefore,
				},
				"read":   {Type: "read"},
				"update": {Type: "update", BeforeParams: []string{"id", "body", "output"}, Before: updateBefore},
				"delete": {Type: "delete"},
			},
		}},
	}
}

func counterPairSchema() *ast.Schema {
	updateBefore := &ast.Block{
		Statements: []ast.Statement{
			&ast.PredicateExpr{Expr: bin(fa("body", "delta"), "!=", lit(nil))},
			&ast.PredicateExpr{Expr: bin(fa("body", "peer_id"), "!=", lit(nil))},
			&ast.Assignment{Name: "n", Value: bin(fa("output", "n"), "+", fa("body", "delta"))},
		},
	}
	updateAfter := &ast.Block{
		Statements: []ast.Statement{
			&ast.EffectUpdateStmt{
				Model:  "Counter",
				IDExpr: fa("body", "peer_id"),
				Fields: []*ast.ModifyAssignment{{
					Field: "n",
					Value: bin(fa("output", "n"), "+", fa("body", "delta")),
				}},
			},
		},
	}
	createBefore := &ast.Block{
		Statements: []ast.Statement{
			&ast.PredicateExpr{Expr: bin(fa("body", "n"), ">=", lit(0.0))},
		},
	}
	return &ast.Schema{
		Models: []*ast.Model{{
			Name: "Counter",
			Fields: []*ast.Field{{
				Name: "n",
				Type: ast.TypeNumber,
			}},
			CRUD: map[string]*ast.Operation{
				"create": {
					Type:         "create",
					BeforeParams: []string{"body"},
					Before:       createBefore,
				},
				"read": {Type: "read"},
				"update": {
					Type:         "update",
					BeforeParams: []string{"id", "body", "output"},
					Before:       updateBefore,
					AfterParams:  []string{"id", "body", "output"},
					After:        updateAfter,
				},
				"delete": {Type: "delete"},
			},
		}},
	}
}
