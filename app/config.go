package app

type Config struct {
	Listen    string
	DB        string
	LogLevel  string
	ListLimit int
	AppID     string

	TelemetryEnabled      bool
	TelemetryMetrics      bool
	TelemetryTraces       bool
	TelemetryServiceName  string
	TelemetryOTLPEndpoint string
}
