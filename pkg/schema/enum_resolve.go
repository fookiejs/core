package schema

import "github.com/fookiejs/fookie/pkg/ast"

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
