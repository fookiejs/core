package runtime

import (
	"testing"

	"github.com/fookiejs/fookie/pkg/ast"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBuildIncomingFKIndex(t *testing.T) {
	parent := "Parent"
	models := []*ast.Model{
		{Name: "Parent"},
		{Name: "Child", Fields: []*ast.Field{
			{Name: "Owner", Type: ast.TypeRelation, Relation: &parent},
		}},
	}
	idx := buildIncomingFKIndex(models)
	require.Len(t, idx["parent"], 1)
	assert.Equal(t, "Child", idx["parent"][0].childModel)
	assert.Equal(t, "owner_id", idx["parent"][0].fkColumn)
}

func TestRelationFKColumn(t *testing.T) {
	f := &ast.Field{Name: "BankAccount", Type: ast.TypeRelation, Relation: new(string)}
	assert.Equal(t, "bank_account_id", relationFKColumn(f))
}
