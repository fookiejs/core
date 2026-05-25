package telemetry

import (
	"errors"
	"testing"
)

func TestNormalizeCustom(t *testing.T) {
	if got := NormalizeCustom("order.created"); got != "custom.order.created" {
		t.Fatalf("got %q", got)
	}
	if got := NormalizeCustom("custom.order.created"); got != "custom.order.created" {
		t.Fatalf("got %q", got)
	}
}

func TestValidateUserMetricReserved(t *testing.T) {
	cases := []string{
		"http.received",
		"graphql.request",
		"runtime.outbox",
		"flow.started",
		"external.retry",
		"custom.http.foo",
	}
	for _, name := range cases {
		if err := ValidateUserMetric(name); !errors.Is(err, ErrReservedMetric) {
			t.Fatalf("%q: want ErrReservedMetric, got %v", name, err)
		}
	}
}

func TestValidateUserMetricAllowed(t *testing.T) {
	if err := ValidateUserMetric("order.created"); err != nil {
		t.Fatal(err)
	}
	if err := ValidateUserMetric("custom.payment.amount"); err != nil {
		t.Fatal(err)
	}
}
