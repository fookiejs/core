package app

import (
	"os"
	"testing"
)

func TestMain(m *testing.M) {
	if _, ok := os.LookupEnv("FOOKIE_LIST_LIMIT"); !ok {
		_ = os.Setenv("FOOKIE_LIST_LIMIT", "50")
	}
	os.Exit(m.Run())
}
