package fookie

import (
	"encoding/json"
	"net/http"
)

func (a *App) serveHTTP() error {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /graphql", a.handleGraphQL)
	mux.HandleFunc("GET /graphql", a.handleGraphQL)
	mux.HandleFunc("GET /health", a.handleHealth)

	addr := a.cfg.Listen
	if addr == "" {
		addr = ":3000"
	}
	flog.Info("app.listening", "addr", addr)
	return http.ListenAndServe(addr, mux) //nolint:gosec,wrapcheck
}

func (a *App) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]any{
		"status":   "ok",
		"models":   len(a.models),
		"handlers": len(a.externalHandlers),
	})
}

func headersMap(r *http.Request) map[string]string {
	m := make(map[string]string, len(r.Header))
	for k, v := range r.Header {
		if len(v) > 0 {
			m[k] = v[0]
		}
	}
	return m
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, code, desc string) {
	writeJSON(w, status, map[string]any{
		"error": map[string]string{"code": code, "description": desc},
	})
}
