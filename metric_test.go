package fookie

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"

	"github.com/fookiejs/fookie/internal/telemetry"
)

func TestFlowMetricIncrement(t *testing.T) {
	var buf bytes.Buffer
	telemetry.SetOutput(&buf)
	defer telemetry.SetOutput(nil)

	m := newFlowMetric("Transaction", "ent_1")
	m.Increment("order.created", map[string]string{"gateway": "test"})

	line := strings.TrimSpace(buf.String())
	var ev map[string]any
	if err := json.Unmarshal([]byte(line), &ev); err != nil {
		t.Fatal(err)
	}
	if ev["name"] != "custom.order.created" {
		t.Fatalf("name=%v", ev["name"])
	}
	if ev["kind"] != "counter" {
		t.Fatalf("kind=%v", ev["kind"])
	}
	if ev["value"].(float64) != 1 {
		t.Fatalf("value=%v", ev["value"])
	}
}

func TestFlowMetricRejectsReserved(t *testing.T) {
	var buf bytes.Buffer
	telemetry.SetOutput(&buf)
	defer telemetry.SetOutput(nil)

	m := newFlowMetric("Transaction", "")
	m.Increment("http.received", nil)

	if buf.Len() != 0 {
		t.Fatalf("expected no metric event, got %s", buf.String())
	}
}
