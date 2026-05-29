package semantic_test

import (
	"testing"

	"github.com/fookiejs/fookie/semantic"
)

func TestInt_ApplyTagMinMax(t *testing.T) {
	var i semantic.Int
	var flags semantic.SchemaFlags
	if !i.ApplyTag("min=0", &flags) {
		t.Fatal("expected min tag handled")
	}
	if !i.ApplyTag("max=100", &flags) {
		t.Fatal("expected max tag handled")
	}
	i.Set(50)
	if err := i.ValidateField("amount"); err != nil {
		t.Fatal(err)
	}
}

func TestApplySchemaTagIndexed(t *testing.T) {
	var flags semantic.SchemaFlags
	if !semantic.ApplySchemaTag("indexed", &flags) {
		t.Fatal("expected indexed handled")
	}
	if !flags.Indexed {
		t.Fatal("expected indexed flag")
	}
}
