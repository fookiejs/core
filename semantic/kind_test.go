package semantic_test

import (
	"testing"

	"github.com/fookiejs/fookie/semantic"
)

func TestStringKind(t *testing.T) {
	var s semantic.String
	if s.Kind() != semantic.StringKind {
		t.Fatalf("got %q want %q", s.Kind(), semantic.StringKind)
	}
	if _, ok := any(s).(semantic.TypedField); !ok {
		t.Fatal("String must implement TypedField")
	}
}

func TestIntKind(t *testing.T) {
	var i semantic.Int
	if i.Kind() != semantic.Int64Kind {
		t.Fatalf("got %q want %q", i.Kind(), semantic.Int64Kind)
	}
}
