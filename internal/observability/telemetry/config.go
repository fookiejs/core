package telemetry

type Config struct {
	Enabled      bool
	Metrics      bool
	Traces       bool
	ServiceName  string
	OTLPEndpoint string
	OTLPProtocol string
}

func ConfigFromInternal(enabled, metrics, traces bool, serviceName, endpoint string) Config {
	return Config{
		Enabled:      enabled,
		Metrics:      metrics,
		Traces:       traces,
		ServiceName:  serviceName,
		OTLPEndpoint: endpoint,
	}
}
