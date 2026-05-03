package fookiegql

import (
	"github.com/fookiejs/fookie/pkg/ast"
	"github.com/fookiejs/fookie/pkg/compiler"
	"github.com/graphql-go/graphql"
)

func MapFieldType(ft ast.FieldType) graphql.Output {
	switch ft {
	case ast.TypeNumber:
		return graphql.Float
	case ast.TypeBoolean:
		return graphql.Boolean
	case ast.TypeID, ast.TypeRelation:
		return graphql.ID
	default:
		return graphql.String
	}
}

func mapFieldTypeToInput(ft ast.FieldType) graphql.Input {
	switch ft {
	case ast.TypeNumber:
		return graphql.Float
	case ast.TypeBoolean:
		return graphql.Boolean
	case ast.TypeID, ast.TypeRelation:
		return graphql.ID
	default:
		return graphql.String
	}
}

func buildEnumTypes(schema *ast.Schema) map[string]*graphql.Enum {
	enumTypes := make(map[string]*graphql.Enum, len(schema.Enums))
	for _, en := range schema.Enums {
		values := graphql.EnumValueConfigMap{}
		for _, v := range en.Values {
			v := v
			values[v] = &graphql.EnumValueConfig{Value: v}
		}
		enumTypes[en.Name] = graphql.NewEnum(graphql.EnumConfig{
			Name:   en.Name,
			Values: values,
		})
	}
	return enumTypes
}

func resolveFieldOutput(f *ast.Field, enumTypes map[string]*graphql.Enum) graphql.Output {
	if f.Type == ast.TypeEnum && f.EnumRef != nil {
		if et, ok := enumTypes[*f.EnumRef]; ok {
			return et
		}
	}
	return MapFieldType(f.Type)
}

func resolveFieldInput(f *ast.Field, enumTypes map[string]*graphql.Enum) graphql.Input {
	if f.Type == ast.TypeEnum && f.EnumRef != nil {
		if et, ok := enumTypes[*f.EnumRef]; ok {
			return et
		}
	}
	return mapFieldTypeToInput(f.Type)
}

func systemFields() graphql.Fields {
	return graphql.Fields{
		"id":         &graphql.Field{Type: graphql.ID, Resolve: fieldResolver("id")},
		"status":     &graphql.Field{Type: graphql.String, Resolve: fieldResolver("status")},
		"created_at": &graphql.Field{Type: graphql.String, Resolve: fieldResolver("created_at")},
		"updated_at": &graphql.Field{Type: graphql.String, Resolve: fieldResolver("updated_at")},
	}
}

func fieldResolver(dbKey string) graphql.FieldResolveFn {
	return func(p graphql.ResolveParams) (interface{}, error) {
		if row, ok := p.Source.(map[string]interface{}); ok {
			return row[dbKey], nil
		}
		return nil, nil
	}
}

func modelFieldResolver(fieldName string) graphql.FieldResolveFn {
	snakeKey := compiler.SnakeCase(fieldName)
	return func(p graphql.ResolveParams) (interface{}, error) {
		if row, ok := p.Source.(map[string]interface{}); ok {
			if v, exists := row[fieldName]; exists {
				return v, nil
			}
			return row[snakeKey], nil
		}
		return nil, nil
	}
}
