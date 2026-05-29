package app

import (
	"bytes"
	"encoding/json"
	"reflect"

	"github.com/fookiejs/fookie/internal/reliability"
	pubmodel "github.com/fookiejs/fookie/model"
)

const externalChannelBuffer = 10

type ExternalEvent struct {
	ID      string
	AppID   string
	Service string
	Input   []byte
}

func (ev ExternalEvent) Decode(v any) error {
	dec := json.NewDecoder(bytes.NewReader(ev.Input))
	dec.DisallowUnknownFields()
	return dec.Decode(v)
}

type ExternalStatus int

const (
	ExternalOK ExternalStatus = iota
	ExternalFail
	ExternalPending
)

type ExternalResult struct {
	ID      string
	Service string
	Status  ExternalStatus
	Output  []byte
	Error   string
}

type externalTypeInfo struct {
	inputType  string
	outputType string
	validate   func([]byte) error
}

func ExternalEvents(a *App) <-chan ExternalEvent {
	if a.eventCh == nil {
		a.eventCh = make(chan ExternalEvent, externalChannelBuffer)
	}
	return a.eventCh
}

func ExternalResults(a *App) chan<- ExternalResult {
	if a.resultCh == nil {
		a.resultCh = make(chan ExternalResult, externalChannelBuffer)
	}
	return a.resultCh
}

func (a *App) ExternalBusEnabled() bool { return a.eventCh != nil }

func (a *App) PublishExternal(name, externalID string, input []byte) error {
	a.eventCh <- ExternalEvent{ID: externalID, AppID: a.appID, Service: name, Input: input}
	return nil
}

func RegisterExternal[Input, Output any](a *App, ext pubmodel.External[Input, Output]) {
	registerExternalTypes[Input, Output](a, ext.Name)
}

func registerExternalTypes[Input, Output any](a *App, name string) {
	a.externals[name] = externalTypeInfo{
		inputType:  reflect.TypeOf((*Input)(nil)).Elem().String(),
		outputType: reflect.TypeOf((*Output)(nil)).Elem().String(),
		validate: func(b []byte) error {
			if len(b) == 0 {
				return nil
			}
			var o Output
			dec := json.NewDecoder(bytes.NewReader(b))
			dec.DisallowUnknownFields()
			return dec.Decode(&o)
		},
	}
}

func (a *App) AppID() string { return a.appID }

func (a *App) startResultLoop() {
	if a.resultCh == nil {
		return
	}
	go func() {
		for r := range a.resultCh {
			a.applyResult(r)
		}
	}()
}

func (a *App) applyResult(r ExternalResult) {
	switch r.Status {
	case ExternalPending:
		return
	case ExternalFail:
		_ = reliability.ReportFailure(a, r.ID, r.Error)
		return
	}
	if ti, ok := a.externals[r.Service]; ok && ti.validate != nil {
		if err := ti.validate(r.Output); err != nil {
			_ = reliability.ReportFailure(a, r.ID, "invalid output: "+err.Error())
			return
		}
	}
	_ = reliability.ReportSuccess(a, r.ID, r.Output)
}
