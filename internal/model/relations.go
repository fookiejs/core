package model

type ChildRelation struct {
	ChildModel *StoredModel
	FKField    FieldDef
}

func WireRelations(models []*StoredModel, byName map[string]*StoredModel) map[string][]ChildRelation {
	childRelations := make(map[string][]ChildRelation)
	for _, modelDefinition := range models {
		for i := range modelDefinition.snapshots {
			field := &modelDefinition.snapshots[i].FieldDef
			if field.RelationName == "" {
				continue
			}
			if rel, ok := byName[field.RelationName]; ok {
				field.Relation = rel
			}
			childRelations[field.RelationName] = append(childRelations[field.RelationName], ChildRelation{
				ChildModel: modelDefinition,
				FKField:    *field,
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
