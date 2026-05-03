package main

import (
	"fmt"
	"log"
	"strings"

	"github.com/fookiejs/fookie/pkg/ast"
	"github.com/fookiejs/fookie/pkg/compiler"
	"github.com/fookiejs/fookie/pkg/parser"
)

const src = `
enum Role {
  admin
  user
  guest
}

enum Status {
  pending
  active
  archived
}

model User {
  fields {
    name: string = "untitled"
    score: number = 0
    is_active: boolean = true
    role: Role = user
    status: Status = pending
  }
  read {}
  create {}
  update {}
  delete {}
}
`

func main() {
	lex := parser.NewLexer(src)
	p := parser.NewParser(lex.Tokenize())
	s, err := p.Parse()
	if err != nil {
		log.Fatal(err)
	}

	enumNames := map[string]bool{}
	for _, en := range s.Enums {
		enumNames[en.Name] = true
	}
	for _, m := range s.Models {
		for _, f := range m.Fields {
			if f.Type == ast.TypeRelation && f.Relation != nil && enumNames[*f.Relation] {
				name := *f.Relation
				f.Type = ast.TypeEnum
				f.EnumRef = &name
				f.Relation = nil
			}
		}
	}

	fmt.Printf("Enums: %d\n", len(s.Enums))
	for _, en := range s.Enums {
		fmt.Printf("  %s: %v\n", en.Name, en.Values)
	}

	gen := compiler.NewSQLGenerator(s)
	sqls, err := gen.Generate()
	if err != nil {
		log.Fatal(err)
	}
	for _, sql := range sqls {
		if strings.Contains(sql, `"user"`) && strings.Contains(sql, "CREATE TABLE") {
			fmt.Println("\n--- User table DDL ---")
			fmt.Println(sql)
		}
	}
}
