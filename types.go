package fookie

import (
	"context"
	"fmt"

	"github.com/fookiejs/fookie/internal/telemetry"
	"github.com/fookiejs/fookie/semantic"
	"github.com/graphql-go/graphql"
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
	Create func(*Flow[S])
	Read   func(*Flow[S])
	Update func(*Flow[S])
	Delete func(*Flow[S])
	List   func(*Flow[S])
}

type External[I any, O any] struct {
	Name           string
	Retry          Retry
	IdempotencyKey func(I) string
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

	TelemetryEnabled      bool
	TelemetryMetrics      bool
	TelemetryTraces       bool
	TelemetryServiceName  string
	TelemetryOTLPEndpoint string
}

type storedModel struct {
	name   string
	fields []FieldDef
	schema any
	runner *modelRunner
}

type externalHandlerFunc func(ctx context.Context, inputJSON []byte) ([]byte, error)

type App struct {
	cfg               Config
	models            []*storedModel
	enums             []*EnumDef
	externalHandlers  map[string]externalHandlerFunc
	compensationLinks map[string]string
	internals         []string
	byName            map[string]*storedModel
	childRelations    map[string][]childRelation
	db                *db
	graphqlSchema     *graphql.Schema
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
		cfg:               cfg,
		byName:            make(map[string]*storedModel),
		externalHandlers:  make(map[string]externalHandlerFunc),
		compensationLinks: make(map[string]string),
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
	tcfg := telemetry.Config{
		Enabled:      a.cfg.TelemetryEnabled,
		Metrics:      a.cfg.TelemetryMetrics,
		Traces:       a.cfg.TelemetryTraces,
		ServiceName:  a.cfg.TelemetryServiceName,
		OTLPEndpoint: a.cfg.TelemetryOTLPEndpoint,
	}
	if !tcfg.Enabled && tcfg.OTLPEndpoint == "" {
		tcfg = telemetry.ConfigFromEnv()
	}
	if err := InitTelemetry(TelemetryConfig{
		Enabled:      tcfg.Enabled,
		Metrics:      tcfg.Metrics,
		Traces:       tcfg.Traces,
		ServiceName:  tcfg.ServiceName,
		OTLPEndpoint: tcfg.OTLPEndpoint,
	}); err != nil {
		flog.Warn("telemetry.init_failed", flogErr, err.Error())
	}

	database, err := openDB(a.cfg.DB)
	if err != nil {
		return fmt.Errorf("fookie: db open: %w", err)
	}
	a.db = database
	flog.Info("app.db_connected")

	if err := a.db.migrate(a.models); err != nil {
		return fmt.Errorf("fookie: migrate: %w", err)
	}
	flog.Info("app.schema_migrated", "models", len(a.models))

	if err := a.db.migrateOutbox(); err != nil {
		return fmt.Errorf("fookie: outbox migrate: %w", err)
	}
	if err := a.db.migrateIdempotency(); err != nil {
		return fmt.Errorf("fookie: idempotency migrate: %w", err)
	}

	startOutboxWorker(a)
	flog.Info("app.outbox_worker_started")

	schema, err := a.buildGraphQLSchema()
	if err != nil {
		return fmt.Errorf("fookie: graphql schema: %w", err)
	}
	a.graphqlSchema = &schema
	flog.Info("app.graphql_ready")

	return a.serveHTTP()
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

// RegisterHandler wires up a forward handler and its optional compensation
// handler for an External service in a single call.
//
// The compensation handler (if non-nil) receives both the original forward
// input and the output the service produced, giving it full context to undo
// the operation. Pass nil when the service does not need compensation.
func RegisterHandler[I, O, R any](a *App, ext External[I, O],
	handler func(I) (O, error),
	compensate func(I, O) (R, error),
) {
	if a.externalHandlers == nil {
		a.externalHandlers = make(map[string]externalHandlerFunc)
	}
	a.externalHandlers[ext.Name] = wrapExternalHandler(handler)

	if compensate == nil {
		return
	}

	compensateName := ext.Name + ".compensate"
	a.externalHandlers[compensateName] = wrapCompensationHandler(compensate)
	if a.compensationLinks == nil {
		a.compensationLinks = make(map[string]string)
	}
	a.compensationLinks[ext.Name] = compensateName
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
	flog.Debug("entity.resume", flogModel, modelName, flogEntityID, entityID)
	if err := stored.runner.resume(entityID); err != nil {
		flog.Warn("entity.resume_error",
			flogModel, modelName,
			flogEntityID, entityID,
			flogErr, err.Error())
		return
	}
	flog.Info("entity.resumed", flogModel, modelName, flogEntityID, entityID)
}
