package telemetry

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
)

func TestEmitCounterShape(t *testing.T) {
	var buf bytes.Buffer
	SetOutput(&buf)
	defer SetOutput(nil)

	EmitCounter("http.request.received", map[string]string{"method": "GET"})

	line := strings.TrimSpace(buf.String())
	var m map[string]any
	if err := json.Unmarshal([]byte(line), &m); err != nil {
		t.Fatal(err)
	}
	if m["type"] != EventTypeMetric {
		t.Fatalf("type=%v", m["type"])
	}
	if m["kind"] != string(KindCounter) {
		t.Fatalf("kind=%v", m["kind"])
	}
	if m["name"] != "http.request.received" {
		t.Fatalf("name=%v", m["name"])
	}
	if m["value"].(float64) != 1 {
		t.Fatalf("value=%v", m["value"])
	}
}

func TestEmitGaugeSnapshot(t *testing.T) {
	var buf bytes.Buffer
	SetOutput(&buf)
	defer SetOutput(nil)

	EmitGauge("runtime.queue.depth", 42, nil)

	var m map[string]any
	if err := json.Unmarshal(buf.Bytes(), &m); err != nil {
		t.Fatal(err)
	}
	if m["kind"] != string(KindGauge) {
		t.Fatalf("kind=%v", m["kind"])
	}
	if m["value"].(float64) != 42 {
		t.Fatalf("value=%v", m["value"])
	}
}

func TestEmitTraceShape(t *testing.T) {
	var buf bytes.Buffer
	SetOutput(&buf)
	defer SetOutput(nil)

	EmitTrace("trc_abc", "external.PayGateway", "external.completed", map[string]string{"service": "PayGateway"})

	var m map[string]any
	if err := json.Unmarshal(buf.Bytes(), &m); err != nil {
		t.Fatal(err)
	}
	if m["type"] != EventTypeTrace {
		t.Fatalf("type=%v", m["type"])
	}
	if m["trace_id"] != "trc_abc" {
		t.Fatalf("trace_id=%v", m["trace_id"])
	}
	if m["event"] != "external.completed" {
		t.Fatalf("event=%v", m["event"])
	}
}
