package app

import (
	"fmt"
	"net/http"
	"sort"
	"time"

	httpapi "github.com/fookiejs/fookie/internal/api/http"
	graphqlapi "github.com/fookiejs/fookie/internal/api/graphql"
	"github.com/fookiejs/fookie/internal/model/flowext"
	"github.com/fookiejs/fookie/internal/model/query"
	"github.com/fookiejs/fookie/internal/model/schemawire"
	"github.com/fookiejs/fookie/internal/observability"
	"github.com/fookiejs/fookie/internal/observability/telemetry"
	"github.com/fookiejs/fookie/internal/persistence"
	"github.com/fookiejs/fookie/internal/platform"
	"github.com/fookiejs/fookie/internal/reliability"
	"github.com/fookiejs/fookie/internal/reliability/outbox"
	"github.com/fookiejs/fookie/internal/runtime"
	"github.com/graphql-go/graphql"
)

type App struct {
	config            Config
	externalHandlers  map[string]flowext.ExternalHandlerFunc
	compensationLinks map[string]string
	byName            map[string]*schemawire.StoredModel
	engines           map[string]*runtime.Engine
	attachers         []func()
	childRelations    map[string][]schemawire.ChildRelation
	database          *persistence.DB
	graphqlSchema     *graphql.Schema
	externals         map[string]externalTypeInfo
	eventCh           chan ExternalEvent
	resultCh          chan ExternalResult
	appID             string
}

func New(build func(*Config)) *App {
	platform.MustLoadEnvs()
	var config Config
	var builtinConfig platform.BuiltinConfig
	platform.ApplyBuiltinConfig(&builtinConfig)
	config.Listen = builtinConfig.Listen
	config.DB = builtinConfig.DB
	config.LogLevel = builtinConfig.LogLevel
	config.ListLimit = builtinConfig.ListLimit
	config.TelemetryEnabled = builtinConfig.TelemetryEnabled
	config.TelemetryMetrics = builtinConfig.TelemetryMetrics
	config.TelemetryTraces = builtinConfig.TelemetryTraces
	config.TelemetryOTLPEndpoint = builtinConfig.TelemetryOTLPEndpoint
	if build != nil {
		build(&config)
	}
	platform.LogLoadedEnvs()
	return &App{
		config:            config,
		byName:            make(map[string]*schemawire.StoredModel),
		engines:           make(map[string]*runtime.Engine),
		externalHandlers:  make(map[string]flowext.ExternalHandlerFunc),
		compensationLinks: make(map[string]string),
		externals:         make(map[string]externalTypeInfo),
	}
}

func RegisterModel[S any](app *App, model *flowext.Model[S]) {
	app.byName[model.Name] = flowext.NewStored(model)
	app.attachers = append(app.attachers, func() {
		app.engines[model.Name] = runtime.BuildEngine(app, model)
	})
}

func (app *App) buildEngines() {
	for _, attach := range app.attachers {
		attach()
	}
}

func (app *App) storedModels() []*schemawire.StoredModel {
	out := make([]*schemawire.StoredModel, 0, len(app.byName))
	for _, stored := range app.byName {
		out = append(out, stored)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out
}

func (app *App) Run() error {
	tcfg := telemetry.ConfigFromInternal(app.config.TelemetryEnabled, app.config.TelemetryMetrics, app.config.TelemetryTraces, app.config.TelemetryServiceName, app.config.TelemetryOTLPEndpoint)
	if !tcfg.Enabled && tcfg.OTLPEndpoint == "" {
		tcfg = telemetry.ConfigFromEnv()
	}
	if err := telemetry.Init(tcfg); err != nil {
		observability.Warn("telemetry.init_failed", observability.ErrKey, err.Error())
	}

	database, err := persistence.OpenDB(app.config.DB)
	if err != nil {
		return fmt.Errorf("fookie: database open: %w", err)
	}
	app.database = database
	observability.Info("app.db_connected")

	if err := app.database.Migrate(schemawire.StoreTables(app.storedModels())); err != nil {
		return fmt.Errorf("fookie: migrate: %w", err)
	}
	observability.Info("app.schema_migrated", "models", len(app.byName))

	if err := outbox.Migrate(app.database.Pool); err != nil {
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
		httpapi.WriteJSON(w, 200, struct {
			Status   string `json:"status"`
			Models   int    `json:"models"`
			Handlers int    `json:"handlers"`
		}{"ok", len(app.byName), len(app.externalHandlers)})
	})

	addr := app.config.Listen
	if addr == "" {
		addr = ":3000"
	}
	observability.Info("app.listening", "addr", addr)
	server := &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	if err := server.ListenAndServe(); err != nil {
		return fmt.Errorf("http listen: %w", err)
	}
	return nil
}

func (app *App) ListenAddr() string {
	if app.config.Listen == "" {
		return ":3000"
	}
	return app.config.Listen
}

func (app *App) ResumeEntity(modelName, entityID string) {
	engine, ok := app.engines[modelName]
	if !ok {
		return
	}
	observability.Debug("entity.resume", observability.ModelKey, modelName, observability.EntityIDKey, entityID)
	if err := engine.Resume(schemawire.ID(entityID)); err != nil {
		observability.Warn("entity.resume_error",
			observability.ModelKey, modelName,
			observability.EntityIDKey, entityID,
			observability.ErrKey, err.Error())
		return
	}
	observability.Info("entity.resumed", observability.ModelKey, modelName, observability.EntityIDKey, entityID)
}

func (app *App) WireRelations() {
	app.childRelations = schemawire.WireRelations(app.storedModels(), app.byName)
}

func (app *App) Models() []*schemawire.StoredModel { return app.storedModels() }

func (app *App) ByName() map[string]*schemawire.StoredModel { return app.byName }

func (app *App) ChildRelations() map[string][]schemawire.ChildRelation { return app.childRelations }

func (app *App) DB() *persistence.DB { return app.database }

func (app *App) GraphQLSchema() *graphql.Schema { return app.graphqlSchema }

func (app *App) SetGraphQLSchema(s *graphql.Schema) { app.graphqlSchema = s }

func (app *App) Config() Config { return app.config }

func (app *App) ListLimit() int { return app.config.ListLimit }

func (app *App) ExternalHandlers() map[string]flowext.ExternalHandlerFunc {
	return app.externalHandlers
}

func (app *App) CompensationLinks() map[string]string { return app.compensationLinks }

func (app *App) Engine(name string) *runtime.Engine { return app.engines[name] }

func (app *App) QueryListNested(stored *schemawire.StoredModel, filters []schemawire.ListFilter) ([]schemawire.Record, error) {
	queryBuilder := query.NewBuilder(stored)
	queryBuilder.Limit = app.config.ListLimit
	for _, f := range filters {
		queryBuilder.Add(f.Field, f.Op, f.Value)
	}
	rows, err := app.database.List(schemawire.TableFor(stored), query.BuildStoreQuery(stored, queryBuilder))
	if err != nil {
		return nil, err
	}
	decode := app.engines[stored.Name].Decode
	out := make([]schemawire.Record, len(rows))
	for i := range rows {
		out[i] = decode(rows[i])
	}
	return out, nil
}
