import { trace } from "npm:@opentelemetry/api"
import { NodeTracerProvider } from "npm:@opentelemetry/sdk-trace-node"
import { ConsoleSpanExporter, SimpleSpanProcessor } from "npm:@opentelemetry/sdk-trace-base"
import { Resource } from "npm:@opentelemetry/resources"

export class OtelCore {
	private provider: NodeTracerProvider
	private exporters: any[] = []

	constructor(config: { exporters?: any[] }) {
		this.provider = new NodeTracerProvider({
			resource: new Resource({
				"service.name": "fookiejs-core",
			}),
		})

		if (config.exporters) {
			this.exporters = config.exporters
			for (const exporter of config.exporters) {
				this.provider.addSpanProcessor(new SimpleSpanProcessor(exporter))
			}
		} else {
			this.provider.addSpanProcessor(new SimpleSpanProcessor(new ConsoleSpanExporter()))
		}

		this.provider.register()
	}

	getTracer() {
		return trace.getTracer("fookiejs")
	}
}
