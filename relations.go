package fookie

type childRelation struct {
	childModel *storedModel
	fkField    FieldDef
}

func (a *App) wireRelations() {
	a.childRelations = make(map[string][]childRelation)
	for _, m := range a.models {
		for i := range m.fields {
			f := &m.fields[i]
			if f.RelationName == "" {
				continue
			}
			if rel, ok := a.byName[f.RelationName]; ok {
				f.Relation = rel
			}
			a.childRelations[f.RelationName] = append(a.childRelations[f.RelationName], childRelation{
				childModel: m,
				fkField:    *f,
			})
		}
	}
}

func childRelationsToParent(a *App, parentName string) []childRelation {
	var out []childRelation
	for _, rels := range a.childRelations {
		for _, cr := range rels {
			if cr.fkField.RelationName == parentName {
				out = append(out, cr)
			}
		}
	}
	return out
}

func countChildRelationsToParent(rels []childRelation, childModel string) int {
	n := 0
	for _, cr := range rels {
		if cr.childModel.name == childModel {
			n++
		}
	}
	return n
}
