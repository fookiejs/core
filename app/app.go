package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"

	graphqlapi "github.com/fookiejs/fookie/internal/api/graphql"
	coremodel "github.com/fookiejs/fookie/internal/model"
	"github.com/fookiejs/fookie/internal/observability"
	"github.com/fookiejs/fookie/internal/persistence"
	"github.com/fookiejs/fookie/internal/platform"
	"github.com/fookiejs/fookie/internal/reliability"
	"github.com/fookiejs/fookie/internal/reliability/outbox"
	"github.com/fookiejs/fookie/internal/runtime"
	"github.com/graphql-go/graphql"
)

type App struct {
	cfg               Config
	externalHandlers  map[string]coremodel.ExternalHandlerFunc
	compensationLinks map[string]string
	byName            map[string]*coremodel.StoredModel
	engines           map[string]*runtime.Engine
	attachers         []func()
	childRelations    map[string][]coremodel.ChildRelation
	db                *persistence.DB
	graphqlSchema     *graphql.Schema
	externals         map[string]externalTypeInfo
	eventCh           chan ExternalEvent
	resultCh          chan ExternalResult
	appID             string
}

func New(build func(*Config)) *App {
	platform.MustLoadEnvs()
	var cfg Config
	var bc platform.BuiltinConfig
	platform.ApplyBuiltinConfig(&bc)
	cfg.Listen = bc.Listen
	cfg.DB = bc.DB
	cfg.LogLevel = bc.LogLevel
	cfg.ListLimit = bc.ListLimit
	cfg.TelemetryEnabled = bc.TelemetryEnabled
	cfg.TelemetryMetrics = bc.TelemetryMetrics
	cfg.TelemetryTraces = bc.TelemetryTraces
	cfg.TelemetryOTLPEndpoint = bc.TelemetryOTLPEndpoint
	if build != nil {
		build(&cfg)
	}
	platform.LogLoadedEnvs()
	return &App{
		cfg:               cfg,
		byName:            make(map[string]*coremodel.StoredModel),
		engines:           make(map[string]*runtime.Engine),
		externalHandlers:  make(map[string]coremodel.ExternalHandlerFunc),
		compensationLinks: make(map[string]string),
		externals:         make(map[string]externalTypeInfo),
	}
}

func RegisterModel[S any](app *App, model *coremodel.Model[S]) {
	app.byName[model.Name] = coremodel.NewStored(model)
	app.attachers = append(app.attachers, func() {
		app.engines[model.Name] = runtime.BuildEngine(app, model)
	})
}

func (app *App) buildEngines() {
	for _, attach := range app.attachers {
		attach()
	}
}

func (app *App) storedModels() []*coremodel.StoredModel {
	out := make([]*coremodel.StoredModel, 0, len(app.byName))
	for _, stored := range app.byName {
		out = append(out, stored)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (app *App) Run() error {
	tcfg := observability.TelemetryConfigFromInternal(app.cfg.TelemetryEnabled, app.cfg.TelemetryMetrics, app.cfg.TelemetryTraces, app.cfg.TelemetryServiceName, app.cfg.TelemetryOTLPEndpoint)
	if !tcfg.Enabled && tcfg.OTLPEndpoint == "" {
		tcfg = observability.ConfigFromEnv()
	}
	if err := observability.InitTelemetry(tcfg); err != nil {
		observability.Warn("telemetry.init_failed", observability.ErrKey, err.Error())
	}

	database, err := persistence.OpenDB(app.cfg.DB)
	if err != nil {
		return fmt.Errorf("fookie: db open: %w", err)
	}
	app.db = database
	observability.Info("app.db_connected")

	if err := app.db.Migrate(coremodel.StoreTables(app.storedModels())); err != nil {
		return fmt.Errorf("fookie: migrate: %w", err)
	}
	observability.Info("app.schema_migrated", "models", len(app.byName))

	if err := outbox.Migrate(app.db.Pool); err != nil {
		return fmt.Errorf("fookie: outbox migrate: %w", err)
	}

	app.buildEngines()
	observability.Info("app.engines_built", "models", len(app.engines))

	app.appID = app.computeAppID()
	observability.Info("app.id", "app_id", app.appID)

	app.startResultLoop()

	reliability.StartOutboxWorker(app)
	observability.Info("app.outbox_worker_started")

	gqlSchema, err := graphqlapi.BuildSchema(app)
	if err != nil {
		return fmt.Errorf("fookie: graphql schema: %w", err)
	}
	app.SetGraphQLSchema(&gqlSchema)
	observability.Info("app.graphql_ready")

	return app.serveHTTP()
}

func (app *App) serveHTTP() error {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /graphql", func(w http.ResponseWriter, r *http.Request) { graphqlapi.HandleGraphQL(app, w, r) })
	mux.HandleFunc("GET /graphql", func(w http.ResponseWriter, r *http.Request) { graphqlapi.HandleGraphQL(app, w, r) })
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(200)
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status":   "ok",
			"models":   len(app.byName),
			"handlers": len(app.externalHandlers),
		})
	})

	addr := app.cfg.Listen
	if addr == "" {
		addr = ":3000"
	}
	observability.Info("app.listening", "addr", addr)
	return http.ListenAndServe(addr, mux)
}

func (app *App) ListenAddr() string {
	if app.cfg.Listen == "" {
		return ":3000"
	}
	return app.cfg.Listen
}

func (app *App) ResumeEntity(modelName, entityID string) {
	engine, ok := app.engines[modelName]
	if !ok {
		return
	}
	observability.Debug("entity.resume", observability.ModelKey, modelName, observability.EntityIDKey, entityID)
	if err := engine.Resume(coremodel.ID(entityID)); err != nil {
		observability.Warn("entity.resume_error",
			observability.ModelKey, modelName,
			observability.EntityIDKey, entityID,
			observability.ErrKey, err.Error())
		return
	}
	observability.Info("entity.resumed", observability.ModelKey, modelName, observability.EntityIDKey, entityID)
}

func (app *App) WireRelations() {
	app.childRelations = coremodel.WireRelations(app.storedModels(), app.byName)
}

func (app *App) Models() []*coremodel.StoredModel { return app.storedModels() }

func (app *App) ByName() map[string]*coremodel.StoredModel { return app.byName }

func (app *App) ChildRelations() map[string][]coremodel.ChildRelation { return app.childRelations }

func (app *App) DB() *persistence.DB { return app.db }

func (app *App) GraphQLSchema() *graphql.Schema { return app.graphqlSchema }

func (app *App) SetGraphQLSchema(s *graphql.Schema) { app.graphqlSchema = s }

func (app *App) Config() Config { return app.cfg }

func (app *App) ListLimit() int { return app.cfg.ListLimit }

func (app *App) ExternalHandlers() map[string]coremodel.ExternalHandlerFunc { return app.externalHandlers }

func (app *App) CompensationLinks() map[string]string { return app.compensationLinks }

func (app *App) Engine(name string) *runtime.Engine { return app.engines[name] }

func (app *App) QueryListNested(stored *coremodel.StoredModel, filters []coremodel.ListFilter) ([]coremodel.Record, error) {
	qb := coremodel.NewBuilder(stored)
	qb.Limit = app.cfg.ListLimit
	for _, f := range filters {
		qb.Add(f.Field, f.Op, f.Value)
	}
	rows, err := app.db.List(coremodel.TableFor(stored), coremodel.BuildStoreQuery(stored, qb))
	if err != nil {
		return nil, err
	}
	decode := app.engines[stored.Name].Decode
	out := make([]coremodel.Record, len(rows))
	for i := range rows {
		out[i] = decode(rows[i])
	}
	return out, nil
}
