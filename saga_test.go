package fookie

import (
	"testing"
)

func TestExternal_NoCompensateField(t *testing.T) {
	ext := External[struct{}, struct{}]{
		Name:  "PayGateway",
		Retry: Retry{Attempts: 3},
	}
	if ext.Name != "PayGateway" {
		t.Errorf("unexpected Name: %q", ext.Name)
	}
}

func TestAutoCompensateAll_NilTx(t *testing.T) {
	ctx := &Flow[struct{}]{}
	if err := autoCompensateAll(ctx); err != nil {
		t.Fatalf("nil tx should be no-op, got %v", err)
	}
}

func TestAutoCompensateAll_EmptyEntityID(t *testing.T) {
	ctx := &Flow[struct{}]{Model: &storedModel{name: "Test"}}
	if err := autoCompensateAll(ctx); err != nil {
		t.Fatalf("empty entityID should be no-op, got %v", err)
	}
}

func TestSagaStep_Struct(t *testing.T) {
	s := sagaStep{
		StepName:   "FraudScore",
		Compensate: "FraudRollback",
		InputJSON:  []byte(`{"amount":1000}`),
		OutputJSON: []byte(`{"score":42,"approved":true}`),
	}
	if s.StepName != "FraudScore" {
		t.Errorf("unexpected StepName: %q", s.StepName)
	}
	if s.Compensate != "FraudRollback" {
		t.Errorf("unexpected Compensate: %q", s.Compensate)
	}
	if string(s.InputJSON) != `{"amount":1000}` {
		t.Errorf("unexpected InputJSON: %s", s.InputJSON)
	}
	if string(s.OutputJSON) != `{"score":42,"approved":true}` {
		t.Errorf("unexpected OutputJSON: %s", s.OutputJSON)
	}
}

func TestSagaStep_CompensateInput_BothFields(t *testing.T) {
	s := sagaStep{
		InputJSON:  []byte(`{"amount":1000}`),
		OutputJSON: []byte(`{"tx_id":"abc123"}`),
	}
	got := s.compensateInput()
	want := `{"input":{"amount":1000},"output":{"tx_id":"abc123"}}`
	if string(got) != want {
		t.Errorf("unexpected compensateInput:\ngot  %s\nwant %s", got, want)
	}
}

func TestSagaStep_CompensateInput_NullOutput(t *testing.T) {
	s := sagaStep{
		InputJSON:  []byte(`{"amount":1000}`),
		OutputJSON: nil,
	}
	got := s.compensateInput()
	want := `{"input":{"amount":1000},"output":null}`
	if string(got) != want {
		t.Errorf("unexpected compensateInput:\ngot  %s\nwant %s", got, want)
	}
}

func TestSagaStep_CompensateInput_EmptyOutputIsNull(t *testing.T) {
	s := sagaStep{
		InputJSON:  []byte(`{"ref":"xyz"}`),
		OutputJSON: []byte{},
	}
	got := s.compensateInput()
	want := `{"input":{"ref":"xyz"},"output":null}`
	if string(got) != want {
		t.Errorf("unexpected compensateInput:\ngot  %s\nwant %s", got, want)
	}
}
