package platform

import (
	"fmt"
	"log"
	"os"
	"strconv"
	"sync"
)

type envAllowed = string

type envClass int

const (
	envClassConfig envClass = iota
	envClassSecret
)

type EnvVar struct {
	key      string
	oneOf    []envAllowed
	class    envClass
	value    string
	loaded   bool
	required bool
}

type envLoader interface {
	loadEnv() error
	logEnv()
}

var envRegistry []envLoader

var (
	listenEnv   = Env("FOOKIE_LISTEN")
	dbEnv       = Env("FOOKIE_DB_URL").Secret()
	logLevelEnv = Env("FOOKIE_LOG_LEVEL").OneOf("debug", "info", "warn", "error")

	otelEnabledEnv  = Env("OTEL_ENABLED").OneOf("true", "false", "1", "0")
	otelMetricsEnv  = Env("OTEL_METRICS").OneOf("true", "false", "1", "0")
	otelTracesEnv   = Env("OTEL_TRACES").OneOf("true", "false", "1", "0")
	otelEndpointEnv = Env("OTEL_EXPORTER_OTLP_ENDPOINT")

	listLimitEnv = Env("FOOKIE_LIST_LIMIT").Required()
)

var envLoad sync.Once
var envLoadErr error
var envReady bool

func MustLoadEnvs() {
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

func Env(key string) *EnvVar {
	e := &EnvVar{key: key, class: envClassConfig}
	envRegistry = append(envRegistry, e)
	return e
}

func (e *EnvVar) Secret() *EnvVar {
	e.class = envClassSecret
	return e
}

func (e *EnvVar) OneOf(values ...envAllowed) *EnvVar {
	e.oneOf = values
	return e
}

func (e *EnvVar) Required() *EnvVar {
	e.required = true
	return e
}

func (e *EnvVar) loadEnv() error {
	raw, ok := os.LookupEnv(e.key)
	if !ok || raw == "" {
		if e.required {
			return fmt.Errorf("env %s: required but not set", e.key)
		}
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
	e.value = raw
	e.loaded = true
	return nil
}

func (e *EnvVar) logEnv() {
	if !e.loaded {
		return
	}
	if e.class == envClassSecret {
		log.Printf("env %s=***", e.key)
		return
	}
	log.Printf("env %s=%s", e.key, e.value)
}

func (e *EnvVar) Value() string {
	if !envReady {
		panic("fookie: env " + e.key + " used before New")
	}
	if !e.loaded {
		panic("fookie: env " + e.key + " not set")
	}
	return e.value
}

func (e *EnvVar) ValueOr(fallback string) string {
	if !envReady || !e.loaded {
		return fallback
	}
	return e.value
}

func (e *EnvVar) IntValue() int {
	n, err := strconv.Atoi(e.Value())
	if err != nil {
		panic("fookie: env " + e.key + " must be an integer")
	}
	return n
}

func loadEnvs() error {
	for _, loader := range envRegistry {
		if err := loader.loadEnv(); err != nil {
			return err
		}
	}
	return nil
}

func LogLoadedEnvs() {
	for _, loader := range envRegistry {
		loader.logEnv()
	}
}

type BuiltinConfig struct {
	Listen                string
	DB                    string
	LogLevel              string
	ListLimit             int
	TelemetryEnabled      bool
	TelemetryMetrics      bool
	TelemetryTraces       bool
	TelemetryOTLPEndpoint string
}

func ApplyBuiltinConfig(config *BuiltinConfig) {
	config.Listen = listenEnv.ValueOr(":3000")
	config.DB = dbEnv.ValueOr("postgres://fookie:fookie_dev@localhost:5432/fookie?sslmode=disable")
	config.LogLevel = logLevelEnv.ValueOr("info")
	config.ListLimit = listLimitEnv.IntValue()
	config.TelemetryEnabled = envBoolEnabled(otelEnabledEnv.ValueOr("false"))
	config.TelemetryMetrics = config.TelemetryEnabled
	if otelMetricsEnv.loaded {
		config.TelemetryMetrics = envBoolEnabled(otelMetricsEnv.value)
	}
	config.TelemetryTraces = config.TelemetryEnabled
	if otelTracesEnv.loaded {
		config.TelemetryTraces = envBoolEnabled(otelTracesEnv.value)
	}
	config.TelemetryOTLPEndpoint = otelEndpointEnv.ValueOr("")
}

func envBoolEnabled(value string) bool {
	return value == "true" || value == "1"
}
