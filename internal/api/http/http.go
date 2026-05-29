package httpapi

import (
	"encoding/json"
	"net/http"
)

func HeadersMap(r *http.Request) map[string]string {
	m := make(map[string]string, len(r.Header))
	for k, v := range r.Header {
		if len(v) > 0 {
			m[k] = v[0]
		}
	}
	return m
}

func WriteJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func WriteErr(w http.ResponseWriter, status int, code, desc string) {
	WriteJSON(w, status, map[string]any{
		"error": map[string]string{"code": code, "description": desc},
	})
}
