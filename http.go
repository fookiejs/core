package fookie

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const jsonKeyData = "data"

func (a *App) serveHTTP() error {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /api/{model}", a.handleCreate)
	mux.HandleFunc("GET /api/{model}", a.handleList)
	mux.HandleFunc("GET /api/{model}/{id}", a.handleRead)
	mux.HandleFunc("PATCH /api/{model}/{id}", a.handleUpdate)
	mux.HandleFunc("DELETE /api/{model}/{id}", a.handleDelete)
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

func (a *App) handleCreate(w http.ResponseWriter, r *http.Request) {
	stored, ok := a.resolveModel(w, r)
	if !ok {
		return
	}
	start := time.Now()
	emitHTTPReceived(r.Method, r.URL.Path, stored.name)
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		emitHTTPDuration(r.Method, r.URL.Path, stored.name, msElapsed(start), 400)
		writeErr(w, 400, "invalid_body", err.Error())
		return
	}
	headers := headersMap(r)
	result, err := stored.runner.create(headers, body)
	dur := msElapsed(start)
	if err != nil {
		status := errStatus(err)
		emitHTTPDuration(r.Method, r.URL.Path, stored.name, dur, status)
		writeErr(w, status, errCode(err), err.Error())
		return
	}
	emitHTTPDuration(r.Method, r.URL.Path, stored.name, dur, 201)
	writeJSON(w, 201, map[string]any{jsonKeyData: result})
}

func (a *App) handleList(w http.ResponseWriter, r *http.Request) {
	stored, ok := a.resolveModel(w, r)
	if !ok {
		return
	}
	emitHTTPReceived(r.Method, r.URL.Path, stored.name)
	cursor := r.URL.Query().Get("cursor")
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	headers := headersMap(r)
	start := time.Now()
	items, nextCursor, err := stored.runner.list(headers, cursor, limit)
	dur := msElapsed(start)
	if err != nil {
		status := errStatus(err)
		emitHTTPDuration(r.Method, r.URL.Path, stored.name, dur, status)
		writeErr(w, status, errCode(err), err.Error())
		return
	}
	emitHTTPDuration(r.Method, r.URL.Path, stored.name, dur, 200)
	if items == nil {
		items = []map[string]any{}
	}
	body := map[string]any{"items": items}
	if nextCursor != "" {
		body["nextCursor"] = nextCursor
	} else {
		body["nextCursor"] = nil
	}
	writeJSON(w, 200, body)
}

func (a *App) handleRead(w http.ResponseWriter, r *http.Request) {
	stored, ok := a.resolveModel(w, r)
	if !ok {
		return
	}
	emitHTTPReceived(r.Method, r.URL.Path, stored.name)
	id := r.PathValue("id")
	headers := headersMap(r)
	start := time.Now()
	result, err := stored.runner.read(headers, id)
	dur := msElapsed(start)
	if err != nil {
		status := errStatus(err)
		if err.Error() == "not_found" {
			status = 404
		}
		emitHTTPDuration(r.Method, r.URL.Path, stored.name, dur, status)
		writeErr(w, status, errCode(err), err.Error())
		return
	}
	emitHTTPDuration(r.Method, r.URL.Path, stored.name, dur, 200)
	writeJSON(w, 200, map[string]any{jsonKeyData: result})
}

func (a *App) handleUpdate(w http.ResponseWriter, r *http.Request) {
	stored, ok := a.resolveModel(w, r)
	if !ok {
		return
	}
	start := time.Now()
	emitHTTPReceived(r.Method, r.URL.Path, stored.name)
	id := r.PathValue("id")
	var body map[string]any
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		emitHTTPDuration(r.Method, r.URL.Path, stored.name, msElapsed(start), 400)
		writeErr(w, 400, "invalid_body", err.Error())
		return
	}
	headers := headersMap(r)
	result, err := stored.runner.update(headers, id, body)
	dur := msElapsed(start)
	if err != nil {
		status := errStatus(err)
		emitHTTPDuration(r.Method, r.URL.Path, stored.name, dur, status)
		writeErr(w, status, errCode(err), err.Error())
		return
	}
	emitHTTPDuration(r.Method, r.URL.Path, stored.name, dur, 200)
	writeJSON(w, 200, map[string]any{jsonKeyData: result})
}

func (a *App) handleDelete(w http.ResponseWriter, r *http.Request) {
	stored, ok := a.resolveModel(w, r)
	if !ok {
		return
	}
	emitHTTPReceived(r.Method, r.URL.Path, stored.name)
	id := r.PathValue("id")
	headers := headersMap(r)
	start := time.Now()
	err := stored.runner.delete(headers, id)
	dur := msElapsed(start)
	if err != nil {
		status := errStatus(err)
		emitHTTPDuration(r.Method, r.URL.Path, stored.name, dur, status)
		writeErr(w, status, errCode(err), err.Error())
		return
	}
	emitHTTPDuration(r.Method, r.URL.Path, stored.name, dur, 204)
	w.WriteHeader(204)
}

func (a *App) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, 200, map[string]any{
		"status":   "ok",
		"models":   len(a.models),
		"handlers": len(a.externalHandlers),
	})
}

func (a *App) resolveModel(w http.ResponseWriter, r *http.Request) (*storedModel, bool) {
	name := r.PathValue("model")
	stored, ok := a.byName[name]
	if !ok {
		for k, m := range a.byName {
			if strings.EqualFold(k, name) {
				stored, ok = m, true
				break
			}
		}
	}
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
	_ = json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, code, desc string) {
	writeJSON(w, status, map[string]any{
		"error": map[string]string{"code": code, "description": desc},
	})
}
