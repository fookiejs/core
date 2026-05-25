package telemetry

import (
	"encoding/json"
	"io"
	"os"
	"sync"
	"time"
)

var (
	outMu sync.Mutex
	out   io.Writer = os.Stdout
)

func SetOutput(w io.Writer) {
	outMu.Lock()
	defer outMu.Unlock()
	if w == nil {
		out = os.Stdout
		return
	}
	out = w
}

func mergeAttrs(base map[string]string, extra map[string]string) map[string]string {
	if len(base) == 0 && len(extra) == 0 {
		return nil
	}
	m := make(map[string]string, len(base)+len(extra))
	for k, v := range base {
		m[k] = v
	}
	for k, v := range extra {
		m[k] = v
	}
	return m
}

func writeLine(v any) {
	outMu.Lock()
	w := out
	outMu.Unlock()
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	b = append(b, '\n')
	_, _ = w.Write(b)
}

func EmitMetric(kind MetricKind, name string, value float64, attrs map[string]string) {
	writeLine(map[string]any{
		"type":       EventTypeMetric,
		"kind":       string(kind),
		"name":       name,
		"value":      value,
		"attributes": mergeAttrs(nil, attrs),
		"timestamp":  time.Now().UTC().Format(time.RFC3339Nano),
	})
}

func EmitTrace(traceID, span, event string, attrs map[string]string) {
	writeLine(map[string]any{
		"type":       EventTypeTrace,
		"trace_id":   traceID,
		"span":       span,
		"event":      event,
		"attributes": mergeAttrs(nil, attrs),
		"timestamp":  time.Now().UTC().Format(time.RFC3339Nano),
	})
}

func EmitCounter(name string, attrs map[string]string) {
	EmitMetric(KindCounter, name, 1, attrs)
}

func EmitHistogram(name string, value float64, attrs map[string]string) {
	EmitMetric(KindHistogram, name, value, attrs)
}

func EmitGauge(name string, value float64, attrs map[string]string) {
	EmitMetric(KindGauge, name, value, attrs)
}
