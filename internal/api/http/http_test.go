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
	rec := httptest.NewRecorder()
	WriteErr(rec, http.StatusBadRequest, "bad", "desc")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("status=%d", rec.Code)
	}
	var body map[string]any
	if err := json.NewDecoder(rec.Body).Decode(&body); err != nil {
		t.Fatal(err)
	}
	errObj := body["error"].(map[string]any)
	if errObj["code"] != "bad" {
		t.Fatalf("code=%v", errObj["code"])
	}
}
