package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHeadersMap(t *testing.T) {
	req := httptest.NewRequestWithContext(context.Background(), http.MethodGet, "/", nil)
	req.Header.Set("X-Test", "abc")
	req.Header.Add("X-Multi", "one")
	req.Header.Add("X-Multi", "two")

	m := HeadersMap(req)
	if m["X-Test"] != "abc" {
		t.Fatalf("X-Test=%q", m["X-Test"])
	}
	if m["X-Multi"] != "one" {
		t.Fatalf("X-Multi=%q", m["X-Multi"])
	}
}

func TestWriteErr(t *testing.T) {
	record := httptest.NewRecorder()
	WriteErr(record, http.StatusBadRequest, "bad", "desc")
	if record.Code != http.StatusBadRequest {
		t.Fatalf("status=%d", record.Code)
	}
	var body map[string]any
	if err := json.NewDecoder(record.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	errObj := body["error"].(map[string]any)
	if errObj["code"] != "bad" {
		t.Fatalf("code=%v", errObj["code"])
	}
}
