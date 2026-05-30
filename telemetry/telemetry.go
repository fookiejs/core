package telemetry

import (
	coretelemetry "github.com/fookiejs/fookie/internal/observability/telemetry"
	"github.com/fookiejs/fookie/internal/observability"
)

type (
	Config     = coretelemetry.Config
	FlowMetric = observability.FlowMetric
)

var (
	ConfigFromEnv            = coretelemetry.ConfigFromEnv
	ConfigFromInternal       = coretelemetry.ConfigFromInternal
	Init                     = coretelemetry.Init
	Shutdown                 = coretelemetry.Shutdown
	NewFlowMetric            = observability.NewFlowMetric
	BindMeterProviderForTest = coretelemetry.BindMeterProviderForTest
)
