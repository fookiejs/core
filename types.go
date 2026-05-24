package fookie

import (
	"context"
	"fmt"
	"log/slog"
	"reflect"

	"github.com/graphql-go/graphql"
	"github.com/fookiejs/fookie/semantic"
)

type EnumDef struct {
	Name   string
	Values []string
}

func DefineEnum(name string, values ...string) *EnumDef {
	return &EnumDef{Name: name, Values: values}
}

type FieldDef struct {
	Name         string
	Kind         kind
	RelationName string
	Relation     *storedModel
	Enum         *EnumDef
	Indexed      bool
	Unique       bool
	Min          *int64
	Max          *int64
}

type Model[S any] struct {
	Name       string
	Field      S
	ID         semantic.ID
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

type OrderExpr struct {
	field string
	desc  bool
}

type orderable interface {
	OrderKey() string
}

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

type externalHandlerFunc func(ctx context.Context, inputJSON []byte) ([]byte, error)

type App struct {
	cfg              Config
	models           []*storedModel
	enums            []*EnumDef
	externalHandlers map[string]externalHandlerFunc
	internals        []string
	byName           map[string]*storedModel
	db               *db
	tel              *telemetry
	graphqlSchema    *graphql.Schema
}

func New(build func(*Config)) *App {
	mustLoadEnvs()
	var cfg Config
	applyBuiltinConfig(&cfg)
	if build != nil {
		build(&cfg)
	}
	logLoadedEnvs()
	return &App{
		cfg:              cfg,
		byName:           make(map[string]*storedModel),
		externalHandlers: make(map[string]externalHandlerFunc),
	}
}

func Register[S any](a *App, m *Model[S]) {
	fields := ensureDefaultID(fieldsFromSchema(m.Field))
	stored := &storedModel{
		name:   m.Name,
		fields: fields,
		schema: m.Field,
	}
	stored.runner = &modelRunner{
		create: makeCreateRunner(a, stored, m.Operations.Create),
		list:   makeListRunner(a, stored, m.Operations.List),
		read:   makeReadRunner(a, stored, m.Operations.Read),
		update: makeUpdateRunner(a, stored, m.Operations.Update),
		delete: makeDeleteRunner(a, stored, m.Operations.Delete),
		resume: makeResumeRunner(a, stored, m.Operations.Create),
	}
	m.stored = stored
	m.Field = attachFieldKeys[S]()
	m.ID.SetFilter("id", nil)
	a.models = append(a.models, stored)
	a.byName[m.Name] = stored
}

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

	if err := a.db.migrateOutbox(); err != nil {
		return fmt.Errorf("fookie: outbox migrate: %w", err)
	}

	a.tel = newTelemetry(a.db.pool)
	if err := a.tel.ensureTables(); err != nil {
		return fmt.Errorf("fookie: telemetry tables: %w", err)
	}
	slog.Info("fookie: telemetry ready")

	startOutboxWorker(a)
	slog.Info("fookie: outbox worker started")

	schema, err := a.buildGraphQLSchema()
	if err != nil {
		return fmt.Errorf("fookie: graphql schema: %w", err)
	}
	a.graphqlSchema = &schema
	slog.Info("fookie: graphql ready")

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

func RegisterExternalHandler[I, O any](a *App, ext External[I, O], h func(context.Context, I) (O, error)) {
	if a.externalHandlers == nil {
		a.externalHandlers = make(map[string]externalHandlerFunc)
	}
	a.externalHandlers[ext.Name] = wrapExternalHandler(h)
}

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

func (a *App) resumeEntity(modelName, entityID string) {
	stored, ok := a.byName[modelName]
	if !ok || stored.runner == nil || stored.runner.resume == nil {
		return
	}
	if err := stored.runner.resume(entityID); err != nil {
		slog.Warn("fookie: resume failed", "model", modelName, "id", entityID, "err", err)
	}
}
