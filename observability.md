# Observability

## Kural

Log, metric ve trace flow'un doğal parçasıdır. Developer altyapı kurmaz; framework otomatik üretir, bağlar ve saklar.

Developer sadece bilinçli olanı yazar:

```ts
flow.log("sipariş onaylandı", { score: result.output.score });
flow.metric.increment("created");
await flow.trace("fraud", async () => flow.external(fraud, { amount: flow.body.amount }));
```

Gerisini framework yapar.

## Trace

Her flow execution tek bir `traceId` (uuid v7) alır.

Aynı trace altında kalır:

- root create / list / update / delete
- nested `flow.create`
- `flow.external` dispatch ve resume
- `setExternalResult` sonrası idempotent rerun
- saga compensate adımları

Span hiyerarşisi:

```
order.create
├── fraud.score
├── orderlog.create
└── notify.send
```

Span otomatik attribute'lar:

- `model` → `Order`
- `entityId` → uuid v7
- `operation` → `create` | `list` | `update` | `delete`
- `signal` → `Done` | `Running` | `Failed`
- `externalId` → external çağrıda
- `externalName` → `fraud.score`

`Running` dönünce span açık kalır, suspend olur. `setExternalResult` gelince aynı span resume edilir, yeni trace açılmaz.

Nested create parent trace'i inherit eder. Ayrı trace yok.

## Log

API:

```ts
flow.log("mesaj", { key: value });
```

- Default level: `info`
- `flow.log.info(...)` yok, direkt `flow.log`
- Structured object zorunlu (ikinci arg)
- String key-value log yok

Framework her log satırına otomatik ekler:

- `traceId`
- `model`
- `entityId`
- `operation`
- `timestamp`

Örnek çıktı:

```json
{
  "level": "info",
  "message": "sipariş onaylandı",
  "traceId": "018f3b5e-...",
  "model": "Order",
  "entityId": "018f3b5e-...",
  "operation": "create",
  "score": 42
}
```

External lifecycle logları framework yazar, developer yazmaz:

- `external.dispatch`
- `external.pending`
- `external.completed`
- `external.failed`
- `flow.suspended`
- `flow.resumed`
- `saga.step_recorded`
- `saga.compensation_dispatched`

## Metric

API:

```ts
flow.metric.increment("created");
flow.metric.histogram("fraud.score", result.output.score);
```

Namespace otomatik: `order.created`, `order.fraud.score`

Developer tam isim yazmaz. Framework `{model}.{name}` yapar.

### Otomatik metrikler (developer yazmaz)

| Metrik | Ne zaman |
|--------|----------|
| `{model}.operation.started` | flow başladı |
| `{model}.operation.completed` | `Done` |
| `{model}.operation.failed` | `Failed` |
| `{model}.operation.suspended` | `Running` |
| `{model}.operation.duration` | histogram, ms |
| `{model}.external.dispatched` | outbox'a yazıldı |
| `{model}.external.completed` | `setExternalResult` |
| `{model}.external.failed` | external fail |
| `{model}.external.retry` | retry attempt |
| `{model}.nested.create` | nested `flow.create` |
| `{model}.saga.compensate` | compensate dispatch |

### Semantic metrikler (developer yazar, kısa isim)

```ts
flow.metric.increment("created");
flow.metric.increment("updated");
flow.metric.increment("deleted");
flow.metric.increment("validation_failed");
flow.metric.increment("external_retry");
```

Framework bunları `order.created`, `order.validation_failed` yapar.

## Saklama

| Kanal | Nereye | Format |
|-------|--------|--------|
| Trace | OTLP / OpenTelemetry | span + attribute |
| Log | stdout / OTLP | structured JSON |
| Metric | OTLP / Prometheus | counter + histogram |

Framework tüm span/counter/histogram'ları `@opentelemetry/api` üzerinden üretir. Uygulama tarafında herhangi bir OTel SDK/exporter register edildiğinde telemetri otomatik oraya akar; SDK yoksa çağrılar no-op'tur. Developer exporter'ı env veya SDK kurulumuyla seçer, framework koduna dokunmaz.

## Flow'da olmayanlar

Observability dışında runtime'a giren şeyler log/metric/trace'e karışmaz:

- `flow.db` yok
- `flow.user` yok
- `flow.context` yok
- `flow.now` yok

Observability sadece: `flow.log`, `flow.metric`, `flow.trace`

## Null / error yok

- Log field'larında `null` yok
- Metric value'da `null` yok
- Trace attribute'da `null` yok
- Fail durumu log level `error` değil, `signal: Failed` + `flow.metric.increment("failed")` ile gider
- Exception throw yok, error object yok

## External + observability

`flow.external(fraud, input)` çağrısında framework otomatik:

1. input'u `Types` → Zod ile validate eder
2. span açar: `fraud.score`
3. outbox'a yazar
4. `onExternalEvent` dispatch eder
5. `Running` döner, `{model}.operation.suspended` metric basar

`setExternalResult` gelince:

1. output'u `Types` → Zod ile validate eder
2. span resume eder
3. `{model}.external.completed` metric basar
4. flow idempotent rerun

## Özet

Developer 3 şey yazar: `flow.log`, `flow.metric`, `flow.trace`

Framework her şeyi bağlar: traceId, model, entityId, operation, duration, external lifecycle, saga lifecycle.

Tüm çalışan süreçler otomatik ölçülür. Developer Prometheus/OTLP/stdout kurmaz.
