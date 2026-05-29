package semantic_test

import (
	"reflect"
	"testing"

	"github.com/fookiejs/fookie/semantic"
)

type cap struct {
	op  string
	val semantic.FilterValue
}

func capture() (semantic.FilterFn, *[]cap) {
	caps := &[]cap{}
	return func(op string, val semantic.FilterValue) { *caps = append(*caps, cap{op, val}) }, caps
}

func assertCap(t *testing.T, caps *[]cap, idx int, op string, val semantic.FilterValue) {
	t.Helper()
	if idx >= len(*caps) {
		t.Fatalf("no capture at index %d (total %d)", idx, len(*caps))
	}
	c := (*caps)[idx]
	if c.op != op || !reflect.DeepEqual(c.val, val) {
		t.Fatalf("cap[%d]: got (%q, %v) want (%q, %v)", idx, c.op, c.val, op, val)
	}
}

func TestValueSetNew(t *testing.T) {
	var s semantic.String
	s.Set("hello")
	if s.Value() != "hello" || semantic.NewString("w").Value() != "w" {
		t.Fatal("String set/new")
	}
	var i semantic.Int
	i.Min(0).Max(100)
	i.Set(50)
	if err := i.ValidateField("age"); err != nil {
		t.Fatal(err)
	}
	i.Set(-1)
	if err := i.ValidateField("age"); err == nil {
		t.Fatal("expected below minimum")
	}
	if semantic.NewInt(7).Value() != 7 || !semantic.NewBool(true).Value() {
		t.Fatal("Int/Bool new")
	}
	var s2 semantic.String
	s2.SetKey("username")
	if s2.OrderKey() != "username" {
		t.Fatalf("order key: got %q", s2.OrderKey())
	}
}

func TestFilters(t *testing.T) {
	type step struct {
		call func()
		op   string
		val  semantic.FilterValue
	}
	tests := []struct {
		name  string
		setup func(fn semantic.FilterFn) []step
	}{
		{"String", func(fn semantic.FilterFn) []step {
			var s semantic.String
			s.SetKey("name")
			s.SetFilter(fn)
			return []step{
				{func() { s.Eq("alice") }, "=", semantic.FilterText("alice")},
				{func() { s.Contains("foo") }, "LIKE", semantic.FilterText("%foo%")},
				{func() { s.In("admin", "mod") }, "IN", semantic.FilterTexts{"admin", "mod"}},
			}
		}},
		{"Int", func(fn semantic.FilterFn) []step {
			var i semantic.Int
			i.SetKey("age")
			i.SetFilter(fn)
			return []step{
				{func() { i.Eq(30) }, "=", semantic.FilterInteger(30)},
				{func() { i.Gte(10) }, ">=", semantic.FilterInteger(10)},
				{func() { i.In(1, 2, 3) }, "IN", semantic.FilterIntegers{1, 2, 3}},
			}
		}},
		{"Float", func(fn semantic.FilterFn) []step {
			var f semantic.Float
			f.SetKey("rate")
			f.SetFilter(fn)
			return []step{{func() { f.Eq(1.5) }, "=", semantic.FilterNumber(1.5)}}
		}},
		{"Bool", func(fn semantic.FilterFn) []step {
			var b semantic.Bool
			b.SetKey("active")
			b.SetFilter(fn)
			return []step{{func() { b.Eq(true) }, "=", semantic.FilterTruth(true)}}
		}},
		{"Currency", func(fn semantic.FilterFn) []step {
			var c semantic.Currency
			c.SetKey("amount")
			c.SetFilter(fn)
			return []step{
				{func() { c.Gte(100) }, ">=", semantic.FilterInteger(100)},
				{func() { c.NotEq(500) }, "!=", semantic.FilterInteger(500)},
			}
		}},
		{"Email", func(fn semantic.FilterFn) []step {
			var e semantic.Email
			e.SetKey("email")
			e.SetFilter(fn)
			return []step{{func() { e.Contains("@gmail") }, "LIKE", semantic.FilterText("%@gmail%")}}
		}},
		{"JSON", func(fn semantic.FilterFn) []step {
			var j semantic.JSON
			j.SetKey("metadata")
			j.SetFilter(fn)
			return []step{{func() { j.HasKey("profile") }, "?", semantic.FilterText("profile")}}
		}},
		{"IP", func(fn semantic.FilterFn) []step {
			var ip semantic.IP
			ip.SetKey("remote_ip")
			ip.SetFilter(fn)
			return []step{{func() { ip.ContainedBy("10.0.0.0/8") }, "<<=", semantic.FilterText("10.0.0.0/8")}}
		}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			fn, caps := capture()
			steps := tt.setup(fn)
			for i, step := range steps {
				step.call()
				assertCap(t, caps, i, step.op, step.val)
			}
			if len(*caps) != len(steps) {
				t.Fatalf("capture count: got %d want %d", len(*caps), len(steps))
			}
		})
	}
}

func TestCoordinateFilters(t *testing.T) {
	var c semantic.Coordinate
	fn, caps := capture()
	c.SetKey("location")
	c.SetFilter(fn)
	c.Near(41.0082, 28.9784, 1000)
	c.WithinBox(40.0, 28.0, 42.0, 30.0)
	if len(*caps) != 2 {
		t.Fatalf("expected 2 captures, got %d", len(*caps))
	}
	cf := (*caps)[0].val.(semantic.CoordinateFilter)
	if cf.Radius != 1000 {
		t.Fatalf("near filter: %+v", cf)
	}
}

func TestSetFilterBehavior(t *testing.T) {
	var s semantic.String
	s.SetKey("my_field")
	fn1, caps1 := capture()
	fn2, caps2 := capture()
	s.SetFilter(fn1)
	s.Eq("a")
	s.SetFilter(fn2)
	s.Eq("b")
	if len(*caps1) != 1 || len(*caps2) != 1 {
		t.Fatal("filter replace failed")
	}
	var name semantic.String
	var age semantic.Int
	sFn, sCaps := capture()
	iFn, iCaps := capture()
	name.SetKey("name")
	name.SetFilter(sFn)
	age.SetKey("age")
	age.SetFilter(iFn)
	name.Eq("bob")
	age.Gte(18)
	age.Lte(65)
	if len(*sCaps) != 1 || len(*iCaps) != 2 {
		t.Fatal("multi-field filter failed")
	}
}

func TestRowField(t *testing.T) {
	var s semantic.String
	if _, ok := any(&s).(semantic.RowField); !ok {
		t.Fatal("String must implement RowField")
	}
	s.Set("hello")
	if v := s.RowValue(); v != "hello" {
		t.Fatalf("RowValue: got %v", v)
	}
	if !s.RowSet("world") || s.Value() != "world" {
		t.Fatal("RowSet failed")
	}
	var i semantic.Int
	i.Set(42)
	if !i.RowSet(int64(99)) || i.Value() != 99 {
		t.Fatal("Int RowSet failed")
	}
}
