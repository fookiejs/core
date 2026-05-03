package runtime

import (
	"context"
	"database/sql"
	"fmt"
	"strings"

	"github.com/fookiejs/fookie/pkg/ast"
	"github.com/fookiejs/fookie/pkg/compiler"
)

type fkIncoming struct {
	childModel string
	fkColumn   string
}

func relationFKColumn(f *ast.Field) string {
	return compiler.SnakeCase(f.Name) + "_id"
}

func buildIncomingFKIndex(models []*ast.Model) map[string][]fkIncoming {
	out := make(map[string][]fkIncoming)
	for _, m := range models {
		for _, f := range m.Fields {
			if f.Type != ast.TypeRelation || f.Relation == nil {
				continue
			}
			parent := strings.ToLower(*f.Relation)
			out[parent] = append(out[parent], fkIncoming{
				childModel: m.Name,
				fkColumn:   relationFKColumn(f),
			})
		}
	}
	return out
}

func disableRelationLockExpand() bool {
	return false
}

func lockGraphMaxTargets() int {
	return 5000
}

func relationFields(m *ast.Model) []*ast.Field {
	var out []*ast.Field
	for _, f := range m.Fields {
		if f.Type == ast.TypeRelation && f.Relation != nil {
			out = append(out, f)
		}
	}
	return out
}

func modelByName(models []*ast.Model, name string) *ast.Model {
	for _, m := range models {
		if strings.EqualFold(m.Name, name) {
			return m
		}
	}
	return nil
}

func (e *Executor) expandRelationLockClosure(ctx context.Context, seeds []lockTarget) ([]lockTarget, error) {
	seeds = dedupSortLockTargets(seeds)
	if disableRelationLockExpand() || e.schema == nil || len(seeds) == 0 {
		return seeds, nil
	}
	maxN := lockGraphMaxTargets()
	incoming := buildIncomingFKIndex(e.schema.Models)
	closed := make(map[string]bool, len(seeds))
	var acc []lockTarget
	queue := append([]lockTarget(nil), seeds...)
	for len(queue) > 0 {
		if len(closed) >= maxN {
			return nil, fmt.Errorf("relation lock closure exceeded FOOKEE_LOCK_GRAPH_MAX (%d)", maxN)
		}
		t := queue[0]
		queue = queue[1:]
		key := t.sortKey()
		if closed[key] {
			continue
		}
		closed[key] = true
		acc = append(acc, t)
		mod := modelByName(e.schema.Models, t.Model)
		if mod == nil {
			continue
		}
		rels := relationFields(mod)
		if len(rels) > 0 {
			cols := make([]string, len(rels))
			for i, f := range rels {
				cols[i] = fmt.Sprintf(`"%s"`, relationFKColumn(f))
			}
			q := fmt.Sprintf(
				`SELECT %s FROM "%s" WHERE id = $1 AND deleted_at IS NULL`,
				strings.Join(cols, ", "),
				compiler.SnakeCase(mod.Name),
			)
			slots := make([]interface{}, len(rels))
			ptrs := make([]interface{}, len(rels))
			for i := range rels {
				ptrs[i] = &slots[i]
			}
			err := e.execer(ctx).QueryRowContext(ctx, q, t.ID).Scan(ptrs...)
			if err != nil {
				if err == sql.ErrNoRows {
					return nil, fmt.Errorf("lock expand forward %s %s: %w", t.Model, t.ID, err)
				}
				return nil, fmt.Errorf("lock expand forward %s %s: %w", t.Model, t.ID, err)
			}
			for i, f := range rels {
				raw := slots[i]
				if raw == nil {
					continue
				}
				rid, err := scanIDFromRow(raw)
				if err != nil || rid == "" {
					continue
				}
				tgt := *f.Relation
				nk := lockTarget{Model: tgt, ID: rid}.sortKey()
				if !closed[nk] {
					queue = append(queue, lockTarget{Model: tgt, ID: rid})
				}
			}
		}
		for _, inc := range incoming[strings.ToLower(t.Model)] {
			q := fmt.Sprintf(
				`SELECT id FROM "%s" WHERE "%s" = $1 AND deleted_at IS NULL`,
				compiler.SnakeCase(inc.childModel),
				inc.fkColumn,
			)
			rows, err := e.execer(ctx).QueryContext(ctx, q, t.ID)
			if err != nil {
				return nil, fmt.Errorf("lock expand backward %s: %w", inc.childModel, err)
			}
			for rows.Next() {
				var raw interface{}
				if err := rows.Scan(&raw); err != nil {
					rows.Close()
					return nil, err
				}
				cid, err := scanIDFromRow(raw)
				if err != nil || cid == "" {
					continue
				}
				nk := lockTarget{Model: inc.childModel, ID: cid}.sortKey()
				if !closed[nk] {
					queue = append(queue, lockTarget{Model: inc.childModel, ID: cid})
				}
			}
			if err := rows.Err(); err != nil {
				rows.Close()
				return nil, err
			}
			if err := rows.Close(); err != nil {
				return nil, err
			}
		}
	}
	return dedupSortLockTargets(acc), nil
}
