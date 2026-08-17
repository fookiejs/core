export type OtlpHandle = {
  shutdown(): Promise<boolean>;
};

export async function otlp(serviceName: string): Promise<readonly OtlpHandle[]> {
  if (typeof serviceName !== "string" || serviceName.length < 1) {
    return [];
  }
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  if (endpoint === undefined || endpoint.length < 1) {
    return [];
  }
  const { NodeSDK } = await import("@opentelemetry/sdk-node");
  const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-http");
  const { OTLPMetricExporter } = await import("@opentelemetry/exporter-metrics-otlp-http");
  const { PeriodicExportingMetricReader } = await import("@opentelemetry/sdk-metrics");
  const { resourceFromAttributes } = await import("@opentelemetry/resources");
  const { ATTR_SERVICE_NAME } = await import("@opentelemetry/semantic-conventions");
  const base = endpoint.replace(/\/$/, "");
  const sdk = new NodeSDK({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: serviceName }),
    traceExporter: new OTLPTraceExporter({ url: `${base}/v1/traces` }),
    metricReader: new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: `${base}/v1/metrics` }),
    }),
  });
  sdk.start();
  return [
    {
      async shutdown() {
        await sdk.shutdown();
        return true;
      },
    },
  ];
}
