package fookie

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strconv"
	"time"
)

// serveHTTP registers routes for all models and starts the HTTP server.
//
// Routes (Go 1.22+ method+path patterns):
//
//	POST   /api/{model}       → Create
//	GET    /api/{model}       → List  (?cursor=<id>&limit=N)
//	GET    /api/{model}/{id}  → Read
//	PATCH  /api/{model}/{id}  → Update
//	DELETE /api/{model}/{id}  → Delete
func (a *App) serveHTTP() error {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/{model}",        a.handleCreate)
	mux.HandleFunc("GET /api/{model}",         a.handleList)
	mux.HandleFunc("GET /api/{model}/{id}",    a.handleRead)
	mux.HandleFunc("PATCH /api/{model}/{id}",  a.handleUpdate)
	mux.HandleFunc("DELETE /api/{model}/{id}", a.handleDelete)

	addr := a.cfg.Listen
	if addr == "" {
		addr = ":3000"
	}
	slog.Info("fookie listening", "addr", addr)
	return http.ListenAndServe(addr, mux)
}

// ── handlers ─────────────────────────────────────────────────────────────────

func (a *App) handleCreate(w http.ResponseWriter, r *http.Request) {
	stored, ok := a.resolveModel(w, r)
	if !ok {
		return
	}
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, 400, "invalid_body", err.Error())
		return
	}
	headers := headersMap(r)
	start := time.Now()
	result, err := stored.runner.create(a, headers, body)
	dur := time.Since(start)
	if err != nil {
		status := errStatus(err)
		a.tel.record(stored.name, "create", r.Method, r.URL.Path, status, dur, err)
		writeErr(w, status, errCode(err), err.Error())
		return
	}
	a.tel.record(stored.name, "create", r.Method, r.URL.Path, 201, dur, nil)
	writeJSON(w, 201, map[string]any{"data": result})
}

func (a *App) handleList(w http.ResponseWriter, r *http.Request) {
	stored, ok := a.resolveModel(w, r)
	if !ok {
		return
	}
	cursor := r.URL.Query().Get("cursor")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	headers := headersMap(r)
	start := time.Now()
	items, nextCursor, err := stored.runner.list(a, headers, cursor, limit)
	dur := time.Since(start)
	if err != nil {
		status := errStatus(err)
		a.tel.record(stored.name, "list", r.Method, r.URL.Path, status, dur, err)
		writeErr(w, status, errCode(err), err.Error())
		return
	}
	a.tel.record(stored.name, "list", r.Method, r.URL.Path, 200, dur, nil)
	writeJSON(w, 200, map[string]any{
		"items":      items,
		"nextCursor": nextCursor,
	})
}

func (a *App) handleRead(w http.ResponseWriter, r *http.Request) {
	stored, ok := a.resolveModel(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	headers := headersMap(r)
	start := time.Now()
	result, err := stored.runner.read(a, headers, id)
	dur := time.Since(start)
	if err != nil {
		status := errStatus(err)
		if err.Error() == "not_found" {
			status = 404
		}
		a.tel.record(stored.name, "read", r.Method, r.URL.Path, status, dur, err)
		writeErr(w, status, errCode(err), err.Error())
		return
	}
	a.tel.record(stored.name, "read", r.Method, r.URL.Path, 200, dur, nil)
	writeJSON(w, 200, map[string]any{"data": result})
}

func (a *App) handleUpdate(w http.ResponseWriter, r *http.Request) {
	stored, ok := a.resolveModel(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeErr(w, 400, "invalid_body", err.Error())
		return
	}
	headers := headersMap(r)
	start := time.Now()
	result, err := stored.runner.update(a, headers, id, body)
	dur := time.Since(start)
	if err != nil {
		status := errStatus(err)
		a.tel.record(stored.name, "update", r.Method, r.URL.Path, status, dur, err)
		writeErr(w, status, errCode(err), err.Error())
		return
	}
	a.tel.record(stored.name, "update", r.Method, r.URL.Path, 200, dur, nil)
	writeJSON(w, 200, map[string]any{"data": result})
}

func (a *App) handleDelete(w http.ResponseWriter, r *http.Request) {
	stored, ok := a.resolveModel(w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	headers := headersMap(r)
	start := time.Now()
	err := stored.runner.delete(a, headers, id)
	dur := time.Since(start)
	if err != nil {
		status := errStatus(err)
		a.tel.record(stored.name, "delete", r.Method, r.URL.Path, status, dur, err)
		writeErr(w, status, errCode(err), err.Error())
		return
	}
	a.tel.record(stored.name, "delete", r.Method, r.URL.Path, 204, dur, nil)
	w.WriteHeader(204)
}

// ── helpers ───────────────────────────────────────────────────────────────────

func (a *App) resolveModel(w http.ResponseWriter, r *http.Request) (*storedModel, bool) {
	name := r.PathValue("model")
	stored, ok := a.byName[name]
	if !ok {
		writeErr(w, 404, "model_not_found", name+" is not registered")
		return nil, false
	}
	if stored.runner == nil {
		writeErr(w, 500, "internal", name+" has no runner")
		return nil, false
	}
	return stored, true
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

func errStatus(err error) int {
	var fe *FailError
	if errors.As(err, &fe) {
		return 422
	}
	return 500
}

func errCode(err error) string {
	var fe *FailError
	if errors.As(err, &fe) {
		return fe.Code
	}
	return "internal"
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, code, desc string) {
	writeJSON(w, status, map[string]any{
		"error": map[string]string{"code": code, "description": desc},
	})
}
