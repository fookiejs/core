package tests

import (
	"testing"

	"github.com/fookiejs/fookie/pkg/ast"
	"github.com/fookiejs/fookie/pkg/parser"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLexerBasic(t *testing.T) {
	input := `model Transaction {
  fields {
    amount: number
    status: string
  }
}`

	lexer := parser.NewLexer(input)
	tokens := lexer.Tokenize()

	assert.Greater(t, len(tokens), 0)
	assert.Equal(t, parser.TOKEN_MODEL, tokens[0].Type)
	assert.Equal(t, "Transaction", tokens[1].Value)
}

func TestParserModel(t *testing.T) {
	input := `
external ValidateToken {
  body {
    token: string
  }
  output {
    userId: id
    valid: boolean
  }
}

model Transaction {
  fields {
    amount: number
    fromWalletId: id
  }

  create {
    before {
      principal = ValidateToken(token: body.token)
      body.amount > 0
      fromWallet.balance >= body.amount
      amount = body.amount
    }

    after {
    }
  }
}
`

	lexer := parser.NewLexer(input)
	tokens := lexer.Tokenize()
	p := parser.NewParser(tokens)
	schema, err := p.Parse()

	require.NoError(t, err)
	assert.NotNil(t, schema)
	assert.Equal(t, 1, len(schema.Models))
	assert.Equal(t, "Transaction", schema.Models[0].Name)
	assert.Equal(t, 1, len(schema.Externals))
	assert.Equal(t, "ValidateToken", schema.Externals[0].Name)
}

func TestParserExternal(t *testing.T) {
	input := `
external FraudCheck {
  body {
    userId: id
    amount: number
  }
  output {
    allowed: boolean
    score: number
  }
}
`

	lexer := parser.NewLexer(input)
	tokens := lexer.Tokenize()
	p := parser.NewParser(tokens)
	schema, err := p.Parse()

	require.NoError(t, err)
	assert.Equal(t, 1, len(schema.Externals))
	ext := schema.Externals[0]
	assert.Equal(t, "FraudCheck", ext.Name)
	assert.Contains(t, ext.Body, "userId")
	assert.Contains(t, ext.Output, "allowed")
}

func TestParserModule(t *testing.T) {
	input := `
module AuthenticateUser {
  before {
    principal = ValidateToken(token: body.token)
    principal.userId != null
  }

  after {
  }

  compensate {
  }
}
`

	lexer := parser.NewLexer(input)
	tokens := lexer.Tokenize()
	p := parser.NewParser(tokens)
	schema, err := p.Parse()

	require.NoError(t, err)
	assert.Equal(t, 1, len(schema.Modules))
	assert.Equal(t, "AuthenticateUser", schema.Modules[0].Name)
}

func TestLexerRejectsLineComments(t *testing.T) {
	input := `
# This is a comment
model User {
  fields {
    email: string --unique
  }
}
`

	lexer := parser.NewLexer(input)
	tokens := lexer.Tokenize()
	hasIllegal := false
	for _, tok := range tokens {
		if tok.Type == parser.TOKEN_ILLEGAL {
			hasIllegal = true
			break
		}
	}
	assert.True(t, hasIllegal)
	_, err := parser.NewParser(tokens).Parse()
	require.Error(t, err)
}

func TestParserCronBlock(t *testing.T) {
	input := `
external CleanExpiredListings {
  body  {}
  output { expired_count: number }
}

external RespawnMonsters {
  body  {}
  output { spawned_count: number }
}

cron {
  CleanExpiredListings("*/1 * * * *") {}
  RespawnMonsters("*/5 * * * *") {}
}
`
	lexer := parser.NewLexer(input)
	tokens := lexer.Tokenize()
	p := parser.NewParser(tokens)
	schema, err := p.Parse()

	require.NoError(t, err)
	require.Len(t, schema.Crons, 1)

	cb := schema.Crons[0]
	require.Len(t, cb.Entries, 2)

	assert.Equal(t, "CleanExpiredListings", cb.Entries[0].Name)
	assert.Equal(t, "*/1 * * * *", cb.Entries[0].CronExpr)

	assert.Equal(t, "RespawnMonsters", cb.Entries[1].Name)
	assert.Equal(t, "*/5 * * * *", cb.Entries[1].CronExpr)
}

func TestParserCronBlock_WithEmptyBody(t *testing.T) {
	input := `
external NotifyAdmin {
  body  { zone: string }
  output { ok: boolean  }
}

cron {
  NotifyAdmin("0 9 * * *") {}
}
`
	lexer := parser.NewLexer(input)
	tokens := lexer.Tokenize()
	p := parser.NewParser(tokens)
	schema, err := p.Parse()

	require.NoError(t, err)
	require.Len(t, schema.Crons, 1)

	entry := schema.Crons[0].Entries[0]
	assert.Equal(t, "NotifyAdmin", entry.Name)
	assert.Equal(t, "0 9 * * *", entry.CronExpr)
	require.NotNil(t, entry.Body)
	assert.Empty(t, entry.Body.Statements)
}

func TestParserConfigBlock(t *testing.T) {
	input := `
config {
  query_page_size: number = 50
  ui_theme: string = "dark"
  rooms_enabled: boolean = true
}
`
	lexer := parser.NewLexer(input)
	tokens := lexer.Tokenize()
	p := parser.NewParser(tokens)
	schema, err := p.Parse()

	require.NoError(t, err)
	require.Len(t, schema.Configs, 3)
	assert.Equal(t, "query_page_size", schema.Configs[0].Key)
	assert.Equal(t, ast.TypeNumber, schema.Configs[0].Type)
	assert.Equal(t, 50.0, schema.Configs[0].Value)
	assert.Equal(t, "ui_theme", schema.Configs[1].Key)
	assert.Equal(t, "dark", schema.Configs[1].Value)
	assert.Equal(t, true, schema.Configs[2].Value)
}

func TestParserSchema_CronAndSeed(t *testing.T) {
	input := `
external TickWorld {
  body {}
  output { ok: boolean }
}

model WorldEvent {
  fields { name: string }
  create { before {} }
  read {}
}

seed {
  WorldEvent(name) {
    { name: "started" }
  }
}

cron {
  TickWorld("* * * * * *") {}
}
`
	lexer := parser.NewLexer(input)
	tokens := lexer.Tokenize()
	p := parser.NewParser(tokens)
	schema, err := p.Parse()

	require.NoError(t, err)
	require.NotEmpty(t, schema.Seeds)
	assert.NotEmpty(t, schema.Crons)
}

func TestLexerBraces(t *testing.T) {
	input := `model User {
  fields {
    name: string
  }
}`

	lexer := parser.NewLexer(input)
	tokens := lexer.Tokenize()

	lbraces := 0
	for _, tok := range tokens {
		if tok.Type == parser.TOKEN_LBRACE {
			lbraces++
		}
	}
	assert.Greater(t, lbraces, 0)
}

func TestParserSeedBlock(t *testing.T) {
	input := `
model ItemCategory {
  fields {
    name:      string
    slot:      string
    max_stack: number
  }
  create {
    before { body.name != "" }
  }
  read {}
  update { before {} }
  delete {}
}

seed {
  ItemCategory(name) {
    { name: "Weapon",     slot: "main_hand", max_stack: 1  }
    { name: "Shield",     slot: "off_hand",  max_stack: 1  }
    { name: "Consumable", slot: "none",      max_stack: 99 }
  }
}
`
	lexer := parser.NewLexer(input)
	tokens := lexer.Tokenize()
	p := parser.NewParser(tokens)
	schema, err := p.Parse()

	require.NoError(t, err)
	require.Len(t, schema.Seeds, 1)

	sb := schema.Seeds[0]
	require.Len(t, sb.Parts, 1)
	require.NotNil(t, sb.Parts[0].Legacy)

	entry := sb.Parts[0].Legacy
	assert.Equal(t, "ItemCategory", entry.Model)
	assert.Equal(t, "name", entry.KeyField)
	require.Len(t, entry.Records, 3)

	assert.Equal(t, "Weapon", entry.Records[0]["name"])
	assert.Equal(t, "main_hand", entry.Records[0]["slot"])
	assert.Equal(t, 1, entry.Records[0]["max_stack"])

	assert.Equal(t, "Consumable", entry.Records[2]["name"])
	assert.Equal(t, 99, entry.Records[2]["max_stack"])
}

func TestParserSeedBlock_MultipleModels(t *testing.T) {
	input := `
model Category {
  fields { name: string }
  create { before {} }
  read {}
  update { before {} }
  delete {}
}

model Player {
  fields { username: string }
  create { before {} }
  read {}
  update { before {} }
  delete {}
}

seed {
  Category(name) {
    { name: "Weapon" }
    { name: "Armor"  }
  }
  Player(username) {
    { username: "Admin" }
  }
}
`
	lexer := parser.NewLexer(input)
	tokens := lexer.Tokenize()
	p := parser.NewParser(tokens)
	schema, err := p.Parse()

	require.NoError(t, err)
	require.Len(t, schema.Seeds, 1)

	sb := schema.Seeds[0]
	require.Len(t, sb.Parts, 2)
	assert.Equal(t, "Category", sb.Parts[0].Legacy.Model)
	assert.Len(t, sb.Parts[0].Legacy.Records, 2)
	assert.Equal(t, "Player", sb.Parts[1].Legacy.Model)
	assert.Len(t, sb.Parts[1].Legacy.Records, 1)
}

func TestParserSeedBlock_ScalarTypes(t *testing.T) {
	input := `
model Thing {
  fields {
    name:     string
    quantity: number
    active:   boolean
    score:    number
  }
  create { before {} }
  read {}
  update { before {} }
  delete {}
}

seed {
  Thing(name) {
    { name: "A", quantity: 10, active: true,  score: 3.14 }
    { name: "B", quantity: 0,  active: false, score: 0.0  }
  }
}
`
	lexer := parser.NewLexer(input)
	tokens := lexer.Tokenize()
	p := parser.NewParser(tokens)
	schema, err := p.Parse()

	require.NoError(t, err)
	require.Len(t, schema.Seeds, 1)
	records := schema.Seeds[0].Parts[0].Legacy.Records
	require.Len(t, records, 2)

	assert.Equal(t, "A", records[0]["name"])
	assert.Equal(t, 10, records[0]["quantity"])
	assert.Equal(t, true, records[0]["active"])
	assert.Equal(t, 3.14, records[0]["score"])

	assert.Equal(t, false, records[1]["active"])
}

func TestParserSeedBlock_ProceduralOrdered(t *testing.T) {
	input := `
model SeedThing {
  fields { name: string required notEmpty code: number required positive }
  create { before {} }
  read {}
  update { before {} }
  delete {}
}

seed {
  SeedThing(name) {
    { name: "static", code: 1 }
  }
  for i in range(1, 3) {
    create SeedThing { name = concat("g", i) code = i }
  }
  SeedThing(name) {
    { name: "static2", code: 2 }
  }
}
`
	lexer := parser.NewLexer(input)
	tokens := lexer.Tokenize()
	p := parser.NewParser(tokens)
	schema, err := p.Parse()
	require.NoError(t, err)
	require.Len(t, schema.Seeds[0].Parts, 3)
	require.NotNil(t, schema.Seeds[0].Parts[0].Legacy)
	assert.Equal(t, "static", schema.Seeds[0].Parts[0].Legacy.Records[0]["name"])
	require.Len(t, schema.Seeds[0].Parts[1].Stmts, 1)
	forIn, ok := schema.Seeds[0].Parts[1].Stmts[0].(*ast.ForIn)
	require.True(t, ok)
	rng, ok := forIn.Iterable.(*ast.BuiltinCall)
	require.True(t, ok)
	assert.Equal(t, "range", rng.Name)
	require.Len(t, forIn.Body.Statements, 1)
	_, ok = forIn.Body.Statements[0].(*ast.EffectCreateStmt)
	require.True(t, ok)
	require.NotNil(t, schema.Seeds[0].Parts[2].Legacy)
	assert.Equal(t, "static2", schema.Seeds[0].Parts[2].Legacy.Records[0]["name"])
}
