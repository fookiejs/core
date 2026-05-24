package fookie

import (
	"fmt"
	"log/slog"
	"reflect"
)

type EnumDef struct {
	Name   string
	Values []string
}

func DefineEnum(name string, values ...string) *EnumDef {
	return &EnumDef{Name: name, Values: values}
}

type FieldDef struct {
	Name     string
	Kind     kind
	Relation *storedModel
	Enum     *EnumDef
	Indexed  bool
	Unique   bool
	Min      *int64
	Max      *int64
}

// Model — fookie model definition.
// Field is populated after Register so callers can write ctx.OrderBy(Account.Field.DailyLimit).
type Model[S any] struct {
	Name       string
	Field      S
	Operations Operations[S]
	stored     *storedModel
}

type Operations[S any] struct {
	Create func(*Ctx[S]) error
	Read   func(*Ctx[S]) error
	Update func(*Ctx[S]) error
	Delete func(*Ctx[S]) error
	List   func(*Ctx[S]) error
}

type External[I any, O any] struct {
	Name  string
	Retry Retry
}

type Retry struct {
	Attempts    int
	Backoff     string
	MaxDelaySec int
}

// OrderExpr — used by ctx.OrderBy(field).
type OrderExpr struct {
	field string
	desc  bool
}

// orderable — implemented by semantic types that expose OrderKey().
type orderable interface {
	OrderKey() string
}

// OrderClause — returned by ctx.OrderBy(field).  Chain .Desc() or .Asc().
type OrderClause struct {
	qb  *queryBuilder
	key string
}

func (o *OrderClause) Desc() {
	if o.qb == nil {
		return
	}
	o.qb.orders = append(o.qb.orders, OrderExpr{field: o.key, desc: true})
}

func (o *OrderClause) Asc() {
	if o.qb == nil {
		return
	}
	o.qb.orders = append(o.qb.orders, OrderExpr{field: o.key, desc: false})
}

type Config struct {
	Listen   string
	DB       string
	LogLevel string
}

type storedModel struct {
	name   string
	fields []FieldDef
	schema any
	runner *modelRunner
}

type App struct {
	cfg       Config
	models    []*storedModel
	enums     []*EnumDef
	externals []any
	internals []string
	byName    map[string]*storedModel
	db        *db
	tel       *telemetry
}

func New(build func(*Config)) *App {
	mustLoadEnvs()
	var cfg Config
	applyBuiltinConfig(&cfg)
	if build != nil {
		build(&cfg)
	}
	logLoadedEnvs()
	return &App{cfg: cfg, byName: make(map[string]*storedModel)}
}

// Register introspects the model schema, builds a storedModel, and wires
// type-erased runners for each CRUD operation.
func Register[S any](a *App, m *Model[S]) {
	fields := ensureDefaultID(fieldsFromSchema(m.Field))
	stored := &storedModel{
		name:   m.Name,
		fields: fields,
		schema: m.Field,
	}
	stored.runner = &modelRunner{
		create: makeCreateRunner(stored, m.Operations.Create),
		list:   makeListRunner(stored, m.Operations.List),
		read:   makeReadRunner(stored, m.Operations.Read),
		update: makeUpdateRunner(stored, m.Operations.Update),
		delete: makeDeleteRunner(stored, m.Operations.Delete),
	}
	m.stored = stored
	m.Field = attachFieldKeys[S]()
	a.models = append(a.models, stored)
	a.byName[m.Name] = stored
}

// Run connects to PostgreSQL, runs migrations, ensures telemetry tables,
// then starts the HTTP server.  Blocks until the server exits.
func (a *App) Run() error {
	database, err := openDB(a.cfg.DB)
	if err != nil {
		return fmt.Errorf("fookie: db open: %w", err)
	}
	a.db = database
	slog.Info("fookie: database connected", "dsn", a.cfg.DB)

	if err := a.db.migrate(a.models); err != nil {
		return fmt.Errorf("fookie: migrate: %w", err)
	}
	slog.Info("fookie: schema migrated", "models", len(a.models))

	a.tel = newTelemetry(a.db.pool)
	if err := a.tel.ensureTables(); err != nil {
		return fmt.Errorf("fookie: telemetry tables: %w", err)
	}
	slog.Info("fookie: telemetry ready")

	return a.serveHTTP()
}

func storedFromModel(model any) *storedModel {
	if model == nil {
		return nil
	}
	v := reflectValue(model)
	if v.Kind() != reflect.Ptr || v.IsNil() {
		return nil
	}
	stored := v.Elem().FieldByName("stored")
	if !stored.IsValid() || stored.IsNil() {
		return nil
	}
	ref, _ := stored.Interface().(*storedModel)
	return ref
}

func ensureDefaultID(fields []FieldDef) []FieldDef {
	for _, f := range fields {
		if f.Name == "id" {
			return fields
		}
	}
	return append([]FieldDef{{Name: "id", Kind: idKind}}, fields...)
}

func (a *App) RegisterEnum(enums ...*EnumDef) {
	a.enums = append(a.enums, enums...)
}

func (a *App) RegisterExternal(exts ...any) {}

type internalDef interface {
	InternalName() string
}

func (a *App) RegisterInternal(defs ...internalDef) {
	for _, def := range defs {
		if def == nil {
			continue
		}
		a.internals = append(a.internals, def.InternalName())
	}
}

func (a *App) ListenAddr() string {
	if a.cfg.Listen == "" {
		return ":3000"
	}
	return a.cfg.Listen
}
