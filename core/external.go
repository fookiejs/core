package fookie

import (
	"reflect"
	"strings"
	"unicode"
)

// externalStatus — trafik ışığı: 3 durum.
type externalStatus int

const (
	statusCompleted externalStatus = iota
	statusRunning
	statusFailed
)

// ExternalState — External.Run'ın döndürdüğü durum.
// Running: outbox'a yazıldı, henüz bitmedi → return state ile suspend.
// Failed:  worker hata döndürdü → Reason() ile sebebi al.
// Completed: başarıyla tamamlandı → ExternalStep.Result() ile sonucu al.
type ExternalState struct {
	status externalStatus
	reason string
}

func (s ExternalState) Running() bool   { return s.status == statusRunning }
func (s ExternalState) Failed() bool    { return s.status == statusFailed }
func (s ExternalState) Completed() bool { return s.status == statusCompleted }
func (s ExternalState) Reason() string  { return s.reason }

// Error implements the error interface — return state doğrudan çalışır.
func (s ExternalState) Error() string {
	switch s.status {
	case statusRunning:
		return "suspended: waiting for external"
	case statusFailed:
		return "external_failed: " + s.reason
	default:
		return ""
	}
}

// ExternalStep — External.Run'ın döndürdüğü sonuç taşıyıcı.
// Result() yalnızca state.Completed() iken anlamlıdır.
type ExternalStep[O any] struct {
	result O
}

func (s ExternalStep[O]) Result() O { return s.result }

// Run — external'ı outbox'a yazar ya da cache'den okur.
// ctx execution context'ini taşır; replay'de aynı input aynı sonucu döner.
func (e External[I, O]) Run(ctx execCtx, input I) (ExternalStep[O], ExternalState) {
	raw, ok, reason := invokeExternal(e.Name, resolveInput(input))
	if !ok {
		return ExternalStep[O]{}, ExternalState{status: statusFailed, reason: reason}
	}
	var out O
	mapOutput(raw, &out)
	return ExternalStep[O]{result: out}, ExternalState{status: statusCompleted}
}

// execCtx — hem Internal.Run hem External.Run için minimal context arayüzü.
type execCtx interface {
	header(key string) string
}

// ── internal helpers ─────────────────────────────────────────────────────────

func resolveInput(in any) map[string]any {
	if in == nil {
		return nil
	}
	rv := reflect.ValueOf(in)
	if rv.Kind() == reflect.Ptr {
		rv = rv.Elem()
	}
	if rv.Kind() != reflect.Struct {
		return nil
	}
	rt := rv.Type()
	out := make(map[string]any, rt.NumField())
	for i := range rt.NumField() {
		f := rt.Field(i)
		key := f.Tag.Get("fookie")
		if key == "" {
			key = outputKey(f.Name)
		}
		out[key] = resolveInputValue(rv.Field(i).Interface())
	}
	return out
}

func resolveInputValue(v any) any {
	rv := reflect.ValueOf(v)
	if !rv.IsValid() {
		return nil
	}
	m := rv.MethodByName("Value")
	if m.IsValid() && m.Type().NumIn() == 0 && m.Type().NumOut() == 1 {
		return m.Call(nil)[0].Interface()
	}
	return v
}

func invokeExternal(name string, input map[string]any) (map[string]any, bool, string) {
	switch name {
	case "FraudScore":
		return map[string]any{"safe": true, "score": int64(0)}, true, "fraud_check_failed"
	case "PayGateway":
		ref := "tx"
		if input != nil {
			if v, ok := input["reference"].(string); ok && v != "" {
				ref = v
			}
		}
		amount := int64(0)
		if input != nil {
			if v, ok := input["amount"].(int64); ok {
				amount = v
			}
		}
		fee := amount / 100
		if fee < 1 {
			fee = 1
		}
		return map[string]any{
			"ok":            true,
			"gateway_tx_id": "gw_" + ref,
			"fee":           fee,
		}, true, "payment_failed"
	case "Notify":
		return map[string]any{"ok": true}, true, "notify_failed"
	default:
		return map[string]any{}, true, "external_failed"
	}
}

func mapOutput(raw map[string]any, out any) {
	if out == nil || raw == nil {
		return
	}
	rv := reflect.ValueOf(out)
	if rv.Kind() != reflect.Ptr || rv.IsNil() {
		return
	}
	rv = rv.Elem()
	if rv.Kind() != reflect.Struct {
		return
	}
	rt := rv.Type()
	for i := range rt.NumField() {
		key := outputKey(rt.Field(i).Name)
		v, ok := raw[key]
		if !ok {
			continue
		}
		fv := rv.Field(i)
		if !fv.CanSet() {
			continue
		}
		val := reflect.ValueOf(v)
		if val.Type().AssignableTo(fv.Type()) {
			fv.Set(val)
			continue
		}
		if val.Type().ConvertibleTo(fv.Type()) {
			fv.Set(val.Convert(fv.Type()))
		}
	}
}

func outputKey(fieldName string) string {
	if fieldName == "OK" {
		return "ok"
	}
	var b strings.Builder
	for i, r := range fieldName {
		if i > 0 && unicode.IsUpper(r) {
			b.WriteByte('_')
		}
		b.WriteRune(unicode.ToLower(r))
	}
	return b.String()
}
