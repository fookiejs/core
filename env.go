package fookie

import (
	"fmt"
	"log"
	"os"
	"sync"
)

type envAllowed = string

type envClass int

const (
	envClassConfig envClass = iota
	envClassSecret
)

type EnvVar[T any] struct {
	key    string
	oneOf  []envAllowed
	class  envClass
	value  T
	loaded bool
}

type envLoader interface {
	loadEnv() error
	logEnv()
}

var envRegistry []envLoader

var (
	listenEnv   = Env[string]("LISTEN")
	dbEnv       = Env[string]("DB_URL").Secret()
	logLevelEnv = Env[string]("LOG_LEVEL").OneOf("debug", "info", "warn", "error")

	otelEnabledEnv  = Env[string]("OTEL_ENABLED").OneOf("true", "false", "1", "0")
	otelMetricsEnv  = Env[string]("OTEL_METRICS").OneOf("true", "false", "1", "0")
	otelTracesEnv   = Env[string]("OTEL_TRACES").OneOf("true", "false", "1", "0")
	otelServiceEnv  = Env[string]("OTEL_SERVICE_NAME")
	otelEndpointEnv = Env[string]("OTEL_EXPORTER_OTLP_ENDPOINT")
)

var envLoad sync.Once
var envLoadErr error
var envReady bool

func mustLoadEnvs() {
	envLoad.Do(func() {
		envLoadErr = loadEnvs()
		if envLoadErr == nil {
			envReady = true
		}
	})
	if envLoadErr != nil {
		panic("fookie: " + envLoadErr.Error())
	}
}

func Env[T any](key string) *EnvVar[T] {
	e := &EnvVar[T]{key: key, class: envClassConfig}
	envRegistry = append(envRegistry, e)
	return e
}

func (e *EnvVar[T]) Secret() *EnvVar[T] {
	e.class = envClassSecret
	return e
}

func (e *EnvVar[string]) OneOf(values ...envAllowed) *EnvVar[string] {
	e.oneOf = values
	return e
}

func (e *EnvVar[T]) loadEnv() error {
	var zero T
	if _, ok := any(zero).(string); !ok {
		return fmt.Errorf("env %s: unsupported type", e.key)
	}
	raw, ok := os.LookupEnv(e.key)
	if !ok || raw == "" {
		return nil
	}
	if len(e.oneOf) > 0 {
		valid := false
		for _, allowed := range e.oneOf {
			if raw == allowed {
				valid = true
				break
			}
		}
		if !valid {
			return fmt.Errorf("env %s: invalid value %q (allowed: %v)", e.key, raw, e.oneOf)
		}
	}
	e.value = any(raw).(T)
	e.loaded = true
	return nil
}

func (e *EnvVar[T]) logEnv() {
	if !e.loaded {
		return
	}
	s, ok := any(e.value).(envAllowed)
	if !ok {
		return
	}
	if e.class == envClassSecret {
		log.Printf("env %s=***", e.key)
		return
	}
	log.Printf("env %s=%s", e.key, s)
}

func (e *EnvVar[T]) Value() T {
	if !envReady {
		panic("fookie: env " + e.key + " used before New")
	}
	if !e.loaded {
		panic("fookie: env " + e.key + " not set")
	}
	return e.value
}

func (e *EnvVar[T]) ValueOr(fallback T) T {
	if !envReady || !e.loaded {
		return fallback
	}
	return e.value
}

func loadEnvs() error {
	for _, loader := range envRegistry {
		if err := loader.loadEnv(); err != nil {
			return err
		}
	}
	return nil
}

func logLoadedEnvs() {
	for _, loader := range envRegistry {
		loader.logEnv()
	}
}

func applyBuiltinConfig(cfg *Config) {
	cfg.Listen = listenEnv.ValueOr(":3000")
	cfg.DB = dbEnv.ValueOr("postgres://fookie:fookie_dev@localhost:5432/fookie?sslmode=disable")
	cfg.LogLevel = logLevelEnv.ValueOr("info")
	cfg.TelemetryEnabled = envTruthy(otelEnabledEnv.ValueOr("false"))
	cfg.TelemetryMetrics = envTruthyOr(otelMetricsEnv, cfg.TelemetryEnabled)
	cfg.TelemetryTraces = envTruthyOr(otelTracesEnv, cfg.TelemetryEnabled)
	cfg.TelemetryServiceName = otelServiceEnv.ValueOr("fookie")
	cfg.TelemetryOTLPEndpoint = otelEndpointEnv.ValueOr("")
}

func envTruthy(v string) bool {
	switch v {
	case "true", "1", "yes", "on":
		return true
	default:
		return false
	}
}

func envTruthyOr(e *EnvVar[string], fallback bool) bool {
	if !e.loaded {
		return fallback
	}
	return envTruthy(e.value)
}
