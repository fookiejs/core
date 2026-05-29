package store

import (
	"fmt"
	"math"
	"testing"

	"github.com/fookiejs/fookie/semantic"
)

func TestBuildFilterClause_DefaultEq(t *testing.T) {
	f := Filter{Field: "name", Op: "=", Value: semantic.FilterText("alice")}
	clause, args, err := buildFilterClause(f, 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if clause != `"name" = $1` {
		t.Errorf("unexpected clause: %q", clause)
	}
	if len(args) != 1 || args[0] != "alice" {
		t.Errorf("unexpected args: %v", args)
	}
}

func TestBuildFilterClause_DefaultGt(t *testing.T) {
	f := Filter{Field: "balance", Op: ">", Value: semantic.FilterInteger(100)}
	clause, args, err := buildFilterClause(f, 3)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if clause != `"balance" > $3` {
		t.Errorf("unexpected clause: %q", clause)
	}
	if len(args) != 1 || args[0] != int64(100) {
		t.Errorf("unexpected args: %v", args)
	}
}

func TestBuildFilterClause_DefaultLike(t *testing.T) {
	f := Filter{Field: "email", Op: "LIKE", Value: semantic.FilterText("%@example.com")}
	clause, args, err := buildFilterClause(f, 2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if clause != `"email" LIKE $2` {
		t.Errorf("unexpected clause: %q", clause)
	}
	if len(args) != 1 {
		t.Errorf("unexpected args: %v", args)
	}
}

func TestBuildFilterClause_IN_String(t *testing.T) {
	vals := semantic.FilterTexts{"a", "b", "c"}
	f := Filter{Field: "status", Op: "IN", Value: vals}
	clause, args, err := buildFilterClause(f, 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if clause != `"status" = ANY($1)` {
		t.Errorf("unexpected clause: %q", clause)
	}
	if len(args) != 1 {
		t.Errorf("expected 1 arg (the slice), got %d", len(args))
	}
	got, ok := args[0].([]string)
	if !ok {
		t.Fatalf("expected []string arg, got %T", args[0])
	}
	if len(got) != 3 || got[0] != "a" || got[2] != "c" {
		t.Errorf("unexpected slice: %v", got)
	}
}

func TestBuildFilterClause_IN_Int64(t *testing.T) {
	vals := semantic.FilterIntegers{1, 2, 3}
	f := Filter{Field: "amount", Op: "IN", Value: vals}
	clause, args, err := buildFilterClause(f, 5)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if clause != `"amount" = ANY($5)` {
		t.Errorf("unexpected clause: %q", clause)
	}
	got, ok := args[0].([]int64)
	if !ok || len(got) != 3 {
		t.Errorf("unexpected IN args: %v", args)
	}
}

func TestBuildFilterClause_IN_AdvancesNCorrectly(t *testing.T) {
	vals := semantic.FilterTexts{"x", "y"}
	f := Filter{Field: "tag", Op: "IN", Value: vals}
	clause, args, err := buildFilterClause(f, 7)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if clause != `"tag" = ANY($7)` {
		t.Errorf("clause should reference $7, got: %q", clause)
	}
	if len(args) != 1 {
		t.Errorf("IN should produce 1 arg (the slice), got %d", len(args))
	}
}

func TestBuildFilterClause_NEAR_ClauseShape(t *testing.T) {
	cf := semantic.CoordinateFilter{Lat: 41.0, Lon: 28.9, Radius: 1000.0}
	f := Filter{Field: "location", Op: "@NEAR", Value: cf}
	clause, args, err := buildFilterClause(f, 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := `"location" <@ box(point($1,$2),point($3,$4))`
	if clause != expected {
		t.Errorf("unexpected clause: %q", clause)
	}
	if len(args) != 4 {
		t.Fatalf("expected 4 args, got %d", len(args))
	}

	dLat := 1000.0 / 111111.0
	dLon := 1000.0 / (111111.0 * math.Cos(41.0*math.Pi/180.0))

	assertFloat(t, args[0], 41.0-dLat, "minLat")
	assertFloat(t, args[1], 28.9-dLon, "minLon")
	assertFloat(t, args[2], 41.0+dLat, "maxLat")
	assertFloat(t, args[3], 28.9+dLon, "maxLon")
}

func TestBuildFilterClause_NEAR_NOffset(t *testing.T) {
	cf := semantic.CoordinateFilter{Lat: 0, Lon: 0, Radius: 500.0}
	f := Filter{Field: "pos", Op: "@NEAR", Value: cf}
	clause, args, err := buildFilterClause(f, 5)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expected := `"pos" <@ box(point($5,$6),point($7,$8))`
	if clause != expected {
		t.Errorf("unexpected clause with n=5: %q", clause)
	}
	if len(args) != 4 {
		t.Errorf("expected 4 args, got %d", len(args))
	}
}

func TestBuildFilterClause_NEAR_WrongType(t *testing.T) {
	f := Filter{Field: "location", Op: "@NEAR", Value: semantic.FilterText("not-a-filter")}
	_, _, err := buildFilterClause(f, 1)
	if err == nil {
		t.Error("expected error for wrong @NEAR value type, got nil")
	}
}

func TestBuildFilterClause_BOX_ClauseShape(t *testing.T) {
	bf := semantic.BoxFilter{MinLat: 40.0, MinLon: 28.0, MaxLat: 42.0, MaxLon: 30.0}
	f := Filter{Field: "area", Op: "@BOX", Value: bf}
	clause, args, err := buildFilterClause(f, 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	expected := `"area" <@ box(point($1,$2),point($3,$4))`
	if clause != expected {
		t.Errorf("unexpected clause: %q", clause)
	}
	if len(args) != 4 {
		t.Fatalf("expected 4 args, got %d", len(args))
	}
	assertFloat(t, args[0], 40.0, "minLat")
	assertFloat(t, args[1], 28.0, "minLon")
	assertFloat(t, args[2], 42.0, "maxLat")
	assertFloat(t, args[3], 30.0, "maxLon")
}

func TestBuildFilterClause_BOX_WrongType(t *testing.T) {
	f := Filter{Field: "area", Op: "@BOX", Value: semantic.FilterInteger(99)}
	_, _, err := buildFilterClause(f, 1)
	if err == nil {
		t.Error("expected error for wrong @BOX value type, got nil")
	}
}

func TestBuildFilterClause_JSONB_Contains(t *testing.T) {
	f := Filter{Field: "data", Op: "@>", Value: semantic.FilterText(`{"key":"val"}`)}
	clause, args, err := buildFilterClause(f, 2)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if clause != `"data" @> $2` {
		t.Errorf("unexpected clause: %q", clause)
	}
	if len(args) != 1 {
		t.Errorf("unexpected args: %v", args)
	}
}

func TestBuildFilterClause_JSONB_HasKey(t *testing.T) {
	f := Filter{Field: "meta", Op: "?", Value: semantic.FilterText("active")}
	clause, args, err := buildFilterClause(f, 4)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if clause != `"meta" ? $4` {
		t.Errorf("unexpected clause: %q", clause)
	}
	if len(args) != 1 {
		t.Errorf("unexpected args: %v", args)
	}
}

func TestBuildFilterClause_INET_ContainedBy(t *testing.T) {
	f := Filter{Field: "ip_addr", Op: "<<=", Value: semantic.FilterText("192.168.0.0/16")}
	clause, args, err := buildFilterClause(f, 1)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if clause != `"ip_addr" <<= $1` {
		t.Errorf("unexpected clause: %q", clause)
	}
	if len(args) != 1 {
		t.Errorf("unexpected args: %v", args)
	}
}

func TestBuildFilterClause_ArgsCountConsistency(t *testing.T) {
	cases := []struct {
		op       string
		value    semantic.FilterValue
		wantArgs int
	}{
		{"=", semantic.FilterText("x"), 1},
		{"!=", semantic.FilterText("x"), 1},
		{">", semantic.FilterInteger(1), 1},
		{"LIKE", semantic.FilterText("%x%"), 1},
		{"IN", semantic.FilterTexts{"a", "b"}, 1},
		{"@>", semantic.FilterText(`{}`), 1},
		{"?", semantic.FilterText("key"), 1},
		{"<<=", semantic.FilterText("10.0.0.0/8"), 1},
		{"@NEAR", semantic.CoordinateFilter{Lat: 0, Lon: 0, Radius: 100}, 4},
		{"@BOX", semantic.BoxFilter{MinLat: 0, MinLon: 0, MaxLat: 1, MaxLon: 1}, 4},
	}
	for _, c := range cases {
		t.Run(fmt.Sprintf("op=%s", c.op), func(t *testing.T) {
			f := Filter{Field: "f", Op: c.op, Value: c.value}
			clause, args, err := buildFilterClause(f, 1)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if clause == "" {
				t.Error("expected non-empty clause")
			}
			if len(args) != c.wantArgs {
				t.Errorf("expected %d args, got %d", c.wantArgs, len(args))
			}
		})
	}
}

func assertFloat(t *testing.T, got any, want float64, label string) {
	t.Helper()
	v, ok := got.(float64)
	if !ok {
		t.Errorf("%s: expected float64, got %T(%v)", label, got, got)
		return
	}
	if math.Abs(v-want) > 1e-9 {
		t.Errorf("%s: expected %v, got %v", label, want, v)
	}
}
