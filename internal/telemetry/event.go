package telemetry

type MetricKind string

const (
	KindCounter   MetricKind = "counter"
	KindHistogram MetricKind = "histogram"
	KindGauge     MetricKind = "gauge"
)

const (
	EventTypeMetric = "metric"
	EventTypeTrace  = "trace"
)
