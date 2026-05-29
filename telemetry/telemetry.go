package telemetry

import "github.com/fookiejs/fookie/internal/observability"

type (
	Config     = observability.Config
	FlowMetric = observability.FlowMetric
)

var (
	Init                     = observability.InitTelemetry
	ConfigFromEnv            = observability.ConfigFromEnv
	Shutdown                 = observability.ShutdownTelemetry
	NewFlowMetric            = observability.NewFlowMetric
	BindMeterProviderForTest = observability.BindMeterProviderForTest
)
