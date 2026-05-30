package app

import (
	"testing"

	"github.com/fookiejs/fookie/internal/model/flowext"
	pubmodel "github.com/fookiejs/fookie/model"
	"github.com/fookiejs/fookie/semantic"
)

type abFraudInput struct {
	Amount int `json:"amount"`
}

type abFraudOutput struct {
	Score int `json:"score"`
}

type abUserFields struct {
	Email semantic.Email
	Name  semantic.String
}

func buildBusApp(extraExternal bool) *App {
	a := New(nil)
	RegisterModel(a, &flowext.Model[abUserFields]{Name: "User"})
	RegisterExternal(a, pubmodel.External[abFraudInput, abFraudOutput]{Name: "fraud.score"})
	if extraExternal {
		RegisterExternal(a, pubmodel.External[abFraudInput, abFraudOutput]{Name: "iban.verify"})
	}
	return a
}

func TestAppID_DeterministicAndChanges(t *testing.T) {
	a1 := buildBusApp(false)
	a2 := buildBusApp(false)
	if a1.computeAppID() != a2.computeAppID() {
		t.Fatalf("same schema must yield same app id: %s vs %s", a1.computeAppID(), a2.computeAppID())
	}
	a3 := buildBusApp(true)
	if a1.computeAppID() == a3.computeAppID() {
		t.Fatal("adding an external must change app id")
	}
	id := a1.computeAppID()
	if len(id) != len("app-")+16 || id[:4] != "app-" {
		t.Fatalf("unexpected app id format: %q", id)
	}
}

func TestAppID_ConfigOverride(t *testing.T) {
	a := New(func(c *Config) { c.AppID = "app-custom" })
	RegisterModel(a, &flowext.Model[abUserFields]{Name: "User"})
	if got := a.computeAppID(); got != "app-custom" {
		t.Fatalf("override ignored: %q", got)
	}
}

func TestExternalOutputValidation_Strict(t *testing.T) {
	a := New(nil)
	RegisterExternal(a, pubmodel.External[abFraudInput, abFraudOutput]{Name: "fraud.score"})
	ti, ok := a.externals["fraud.score"]
	if !ok || ti.validate == nil {
		t.Fatal("validator not registered")
	}
	if err := ti.validate([]byte(`{"score":10}`)); err != nil {
		t.Fatalf("valid output rejected: %v", err)
	}
	if err := ti.validate(nil); err != nil {
		t.Fatalf("empty output should be allowed: %v", err)
	}
	if err := ti.validate([]byte(`{"score":10,"junk":1}`)); err == nil {
		t.Fatal("unknown field must be rejected")
	}
	if err := ti.validate([]byte(`{"score":"x"}`)); err == nil {
		t.Fatal("wrong type must be rejected")
	}
}

func TestExternalChannels_PublishAndDecode(t *testing.T) {
	a := New(nil)
	if a.ExternalBusEnabled() {
		t.Fatal("bus should be disabled before ExternalEvents")
	}
	events := ExternalEvents(a)
	if !a.ExternalBusEnabled() {
		t.Fatal("bus should be enabled after ExternalEvents")
	}
	_ = ExternalResults(a)
	a.appID = "app-test"

	go func() { _ = a.PublishExternal("fraud.score", "ck-1", []byte(`{"amount":5}`)) }()

	got := <-events
	if got.ID != "ck-1" || got.Service != "fraud.score" || got.AppID != "app-test" {
		t.Fatalf("event mismatch: %+v", got)
	}
	var in abFraudInput
	if err := got.Decode(&in); err != nil || in.Amount != 5 {
		t.Fatalf("decode failed: err=%v amount=%d", err, in.Amount)
	}
}

func TestExternalEvent_DecodeStrict(t *testing.T) {
	ev := ExternalEvent{Input: []byte(`{"amount":5,"junk":1}`)}
	var in abFraudInput
	if err := ev.Decode(&in); err == nil {
		t.Fatal("unknown field must fail strict decode")
	}
}

func TestApplyResult_PendingIsNoop(t *testing.T) {
	a := New(nil)
	a.applyResult(ExternalResult{ID: "ck-x", Status: ExternalPending})
}
