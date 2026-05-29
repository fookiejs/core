package telemetry

type Config struct {
	Enabled      bool
	Metrics      bool
	Traces       bool
	ServiceName  string
	OTLPEndpoint string
	OTLPProtocol string
}
