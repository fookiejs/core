package app

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	graphqlapi "github.com/fookiejs/fookie/internal/api/graphql"
	"github.com/fookiejs/fookie/internal/model/flowext"
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

func TestGraphQLSchema_NamingAndRelations(t *testing.T) {
	a := New(nil)
	RegisterModel(a, &flowext.Model[gqlUserFields]{Name: "User"})
	RegisterModel(a, &flowext.Model[gqlProductFields]{Name: "Product"})

	gqlSchema, err := graphqlapi.BuildSchema(a)
	if err != nil {
		t.Fatalf("BuildSchema: %v", err)
	}

	queryFields := gqlSchema.QueryType().Fields()
	if queryFields["ALL_User"] == nil || queryFields["User_ID"] == nil {
		t.Fatal("expected ALL_User and User_ID query fields")
	}
	userObj, ok := gqlSchema.Type("User").(*graphql.Object)
	if !ok || userObj.Fields()["ALL_Product"] == nil {
		t.Fatal("User should expose nested ALL_Product")
	}
}

func TestHandleGraphQL_SchemaNotReady(t *testing.T) {
	a := New(nil)
	req := httptest.NewRequestWithContext(context.Background(), http.MethodPost, "/graphql", strings.NewReader(`{"query":"{}"}`))
	record := httptest.NewRecorder()
	graphqlapi.HandleGraphQL(a, record, req)
	if record.Code != http.StatusInternalServerError {
		t.Fatalf("status=%d", record.Code)
	}
}
