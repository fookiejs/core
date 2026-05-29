package model

type ChildRelation struct {
	ChildModel *StoredModel
	FKField    FieldDef
}

func WireRelations(models []*StoredModel, byName map[string]*StoredModel) map[string][]ChildRelation {
	childRelations := make(map[string][]ChildRelation)
	for _, m := range models {
		for i := range m.snapshots {
			f := &m.snapshots[i].FieldDef
			if f.RelationName == "" {
				continue
			}
			if rel, ok := byName[f.RelationName]; ok {
				f.Relation = rel
			}
			childRelations[f.RelationName] = append(childRelations[f.RelationName], ChildRelation{
				ChildModel: m,
				FKField:    *f,
			})
		}
	}
	return childRelations
}

func ChildRelationsForParent(childRelations map[string][]ChildRelation, parentName string) []ChildRelation {
	var out []ChildRelation
	for _, rels := range childRelations {
		for _, cr := range rels {
			if cr.FKField.RelationName == parentName {
				out = append(out, cr)
			}
		}
	}
	return out
}

func CountChildRelationsToParent(rels []ChildRelation, childModel string) int {
	n := 0
	for _, cr := range rels {
		if cr.ChildModel.Name == childModel {
			n++
		}
	}
	return n
}
