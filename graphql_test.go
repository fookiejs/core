package fookie

import (
	"testing"

	"github.com/fookiejs/fookie/semantic"
	"github.com/graphql-go/graphql"
)

type gqlUserFields struct {
	Email semantic.Email
	Name  semantic.String
}

type gqlProductFields struct {
	User  semantic.ID `fookie:"relation:User,indexed"`
	Title semantic.String
	Price semantic.Currency
}

func TestFieldDef_ColumnName(t *testing.T) {
	user := FieldDef{Name: "user", Kind: idKind, RelationName: "User"}
	if user.ColumnName() != "user_id" {
		t.Fatalf("ColumnName() = %q, want user_id", user.ColumnName())
	}
	fromAccount := FieldDef{Name: "from_account", Kind: idKind, RelationName: "Account"}
	if fromAccount.ColumnName() != "from_account_id" {
		t.Fatalf("ColumnName() = %q, want from_account_id", fromAccount.ColumnName())
	}
	email := FieldDef{Name: "email", Kind: emailKind}
	if email.ColumnName() != "email" {
		t.Fatalf("ColumnName() = %q, want email", email.ColumnName())
	}
}

func TestGraphQLSchema_NamingAndRelations(t *testing.T) {
	app := New(nil)
	Register(app, &Model[gqlUserFields]{Name: "User"})
	Register(app, &Model[gqlProductFields]{Name: "Product"})

	schema, err := app.buildGraphQLSchema()
	if err != nil {
		t.Fatalf("buildGraphQLSchema: %v", err)
	}

	queryFields := schema.QueryType().Fields()
	if queryFields["ALL_User"] == nil {
		t.Fatal("expected ALL_User query field")
	}
	if queryFields["User_ID"] == nil {
		t.Fatal("expected User_ID query field")
	}
	if queryFields["users"] != nil || queryFields["user"] != nil {
		t.Fatal("legacy user/users query fields should not exist")
	}

	allUser := queryFields["ALL_User"]
	if !hasGraphQLArg(allUser, "cursor") || !hasGraphQLArg(allUser, "limit") {
		t.Fatal("ALL_User should accept cursor and limit")
	}
	if !hasGraphQLArg(allUser, "filter") {
		t.Fatal("ALL_User should accept filter")
	}

	userObj, ok := schema.Type("User").(*graphql.Object)
	if !ok || userObj == nil {
		t.Fatal("User object type missing")
	}
	userFields := userObj.Fields()
	if userFields["ALL_Product"] == nil {
		t.Fatal("User should expose nested ALL_Product")
	}
	nested := userFields["ALL_Product"]
	if hasGraphQLArg(nested, "cursor") || hasGraphQLArg(nested, "limit") {
		t.Fatal("nested ALL_Product must not accept cursor or limit")
	}
	if !hasGraphQLArg(nested, "filter") {
		t.Fatal("nested ALL_Product should accept filter")
	}

	productObj, ok := schema.Type("Product").(*graphql.Object)
	if !ok || productObj == nil {
		t.Fatal("Product object type missing")
	}
	productFields := productObj.Fields()
	if productFields["User"] == nil {
		t.Fatal("Product should expose User relation field")
	}
	if productFields["user"] != nil || productFields["user_id"] != nil {
		t.Fatal("Product should not expose snake_case relation fields")
	}
}
func hasGraphQLArg(field *graphql.FieldDefinition, name string) bool {
	if field == nil {
		return false
	}
	for _, arg := range field.Args {
		if arg != nil && arg.Name() == name {
			return true
		}
	}
	return false
}

func TestNormalizeGraphQLInput(t *testing.T) {
	stored := &storedModel{
		name: "Product",
		fields: []FieldDef{
			{Name: "user", Kind: idKind, RelationName: "User"},
			{Name: "title", Kind: stringKind},
		},
	}
	out := normalizeGraphQLInput(stored, map[string]any{
		"User":  "u1",
		"title": "Book",
	})
	if out["user"] != "u1" {
		t.Fatalf("expected user=u1, got %v", out["user"])
	}
	if _, ok := out["User"]; ok {
		t.Fatal("User key should be mapped to user")
	}
}
