package semantic_test

import (
	"testing"

	"github.com/fookiejs/fookie/semantic"
)

// --- helpers ---------------------------------------------------------------

type cap struct {
	op  string
	val any
}

func capture() (func(string, any), *[]cap) {
	caps := &[]cap{}
	return func(op string, val any) { *caps = append(*caps, cap{op, val}) }, caps
}

func assertCap(t *testing.T, caps *[]cap, idx int, op string, val any) {
	t.Helper()
	if idx >= len(*caps) {
		t.Fatalf("no capture at index %d (total %d)", idx, len(*caps))
	}
	c := (*caps)[idx]
	if c.op != op {
		t.Fatalf("cap[%d].op: got %q want %q", idx, c.op, op)
	}
	if c.val != val {
		t.Fatalf("cap[%d].val: got %v (%T) want %v (%T)", idx, c.val, c.val, val, val)
	}
}

func assertLen(t *testing.T, caps *[]cap, n int) {
	t.Helper()
	if len(*caps) != n {
		t.Fatalf("capture count: got %d want %d, caps=%+v", len(*caps), n, *caps)
	}
}

// ===========================================================================
// String
// ===========================================================================

func TestString_ZeroValue(t *testing.T) {
	var s semantic.String
	if s.Value() != "" {
		t.Fatalf("got %q", s.Value())
	}
}

func TestString_Set(t *testing.T) {
	var s semantic.String
	s.Set("hello")
	if s.Value() != "hello" {
		t.Fatalf("got %q", s.Value())
	}
}

func TestString_SetOverwrite(t *testing.T) {
	var s semantic.String
	s.Set("first")
	s.Set("second")
	if s.Value() != "second" {
		t.Fatalf("got %q", s.Value())
	}
}

func TestString_SetEmpty(t *testing.T) {
	var s semantic.String
	s.Set("x")
	s.Set("")
	if s.Value() != "" {
		t.Fatalf("expected empty")
	}
}

func TestString_New(t *testing.T) {
	if semantic.NewString("w").Value() != "w" {
		t.Fatal("NewString failed")
	}
}

func TestString_Eq(t *testing.T) {
	var s semantic.String
	fn, caps := capture()
	s.SetFilter("name", fn)
	s.Eq("alice")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "=", "alice")
}

func TestString_NotEq(t *testing.T) {
	var s semantic.String
	fn, caps := capture()
	s.SetFilter("name", fn)
	s.NotEq("bob")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "!=", "bob")
}

func TestString_Contains(t *testing.T) {
	var s semantic.String
	fn, caps := capture()
	s.SetFilter("bio", fn)
	s.Contains("foo")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "LIKE", "%foo%")
}

func TestString_StartsWith(t *testing.T) {
	var s semantic.String
	fn, caps := capture()
	s.SetFilter("slug", fn)
	s.StartsWith("pre")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "LIKE", "pre%")
}

func TestString_EndsWith(t *testing.T) {
	var s semantic.String
	fn, caps := capture()
	s.SetFilter("path", fn)
	s.EndsWith(".go")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "LIKE", "%.go")
}

func TestString_In(t *testing.T) {
	var s semantic.String
	fn, caps := capture()
	s.SetFilter("role", fn)
	s.In("admin", "mod")
	assertLen(t, caps, 1)
	if (*caps)[0].op != "IN" {
		t.Fatalf("op: got %q want IN", (*caps)[0].op)
	}
	vals, ok := (*caps)[0].val.([]string)
	if !ok || len(vals) != 2 || vals[0] != "admin" || vals[1] != "mod" {
		t.Fatalf("val: %+v", (*caps)[0].val)
	}
}

func TestString_NilFilter_NoPanic(t *testing.T) {
	var s semantic.String
	s.Eq("x")
	s.NotEq("x")
	s.Contains("x")
	s.StartsWith("x")
	s.EndsWith("x")
	s.In("x")
}

func TestString_OrderKey(t *testing.T) {
	var s semantic.String
	s.SetFilter("username", nil)
	if s.OrderKey() != "username" {
		t.Fatalf("got %q", s.OrderKey())
	}
}

func TestString_OrderKeyBeforeSetFilter(t *testing.T) {
	var s semantic.String
	if s.OrderKey() != "" {
		t.Fatal("should be empty before SetFilter")
	}
}

// ===========================================================================
// Int
// ===========================================================================

func TestInt_ZeroValue(t *testing.T) {
	var i semantic.Int
	if i.Value() != 0 {
		t.Fatalf("got %d", i.Value())
	}
}

func TestInt_Set(t *testing.T) {
	var i semantic.Int
	i.Set(42)
	if i.Value() != 42 {
		t.Fatalf("got %d", i.Value())
	}
}

func TestInt_Negative(t *testing.T) {
	var i semantic.Int
	i.Set(-999)
	if i.Value() != -999 {
		t.Fatalf("got %d", i.Value())
	}
}

func TestInt_MaxInt64(t *testing.T) {
	const max = int64(^uint64(0) >> 1)
	var i semantic.Int
	i.Set(max)
	if i.Value() != max {
		t.Fatal("max int64 round-trip failed")
	}
}

func TestInt_New(t *testing.T) {
	if semantic.NewInt(7).Value() != 7 {
		t.Fatal("NewInt failed")
	}
}

func TestInt_Eq(t *testing.T) {
	var i semantic.Int
	fn, caps := capture()
	i.SetFilter("age", fn)
	i.Eq(30)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "=", int64(30))
}

func TestInt_NotEq(t *testing.T) {
	var i semantic.Int
	fn, caps := capture()
	i.SetFilter("age", fn)
	i.NotEq(0)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "!=", int64(0))
}

func TestInt_Gt(t *testing.T) {
	var i semantic.Int
	fn, caps := capture()
	i.SetFilter("score", fn)
	i.Gt(5)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, ">", int64(5))
}

func TestInt_Gte(t *testing.T) {
	var i semantic.Int
	fn, caps := capture()
	i.SetFilter("score", fn)
	i.Gte(10)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, ">=", int64(10))
}

func TestInt_Lt(t *testing.T) {
	var i semantic.Int
	fn, caps := capture()
	i.SetFilter("score", fn)
	i.Lt(100)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "<", int64(100))
}

func TestInt_Lte(t *testing.T) {
	var i semantic.Int
	fn, caps := capture()
	i.SetFilter("score", fn)
	i.Lte(99)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "<=", int64(99))
}

func TestInt_Range(t *testing.T) {
	var i semantic.Int
	fn, caps := capture()
	i.SetFilter("rank", fn)
	i.Gte(1)
	i.Lte(10)
	assertLen(t, caps, 2)
	if (*caps)[0].op != ">=" || (*caps)[1].op != "<=" {
		t.Fatalf("ops: %+v", *caps)
	}
}

func TestInt_In(t *testing.T) {
	var i semantic.Int
	fn, caps := capture()
	i.SetFilter("tier", fn)
	i.In(1, 2, 3)
	assertLen(t, caps, 1)
	if (*caps)[0].op != "IN" {
		t.Fatalf("op: %q", (*caps)[0].op)
	}
	vals, ok := (*caps)[0].val.([]int64)
	if !ok || len(vals) != 3 {
		t.Fatalf("val: %+v", (*caps)[0].val)
	}
}

func TestInt_NilFilter_NoPanic(t *testing.T) {
	var i semantic.Int
	i.Eq(1)
	i.NotEq(1)
	i.Gt(1)
	i.Gte(1)
	i.Lt(1)
	i.Lte(1)
	i.In(1, 2)
}

func TestInt_OrderKey(t *testing.T) {
	var i semantic.Int
	i.SetFilter("count", nil)
	if i.OrderKey() != "count" {
		t.Fatalf("got %q", i.OrderKey())
	}
}

// ===========================================================================
// Float
// ===========================================================================

func TestFloat_ZeroValue(t *testing.T) {
	var f semantic.Float
	if f.Value() != 0.0 {
		t.Fatalf("got %f", f.Value())
	}
}

func TestFloat_Set(t *testing.T) {
	var f semantic.Float
	f.Set(3.14)
	if f.Value() != 3.14 {
		t.Fatalf("got %f", f.Value())
	}
}

func TestFloat_New(t *testing.T) {
	if semantic.NewFloat(2.71).Value() != 2.71 {
		t.Fatal("NewFloat failed")
	}
}

func TestFloat_Eq(t *testing.T) {
	var f semantic.Float
	fn, caps := capture()
	f.SetFilter("rate", fn)
	f.Eq(1.5)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "=", 1.5)
}

func TestFloat_NotEq(t *testing.T) {
	var f semantic.Float
	fn, caps := capture()
	f.SetFilter("rate", fn)
	f.NotEq(0.0)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "!=", 0.0)
}

func TestFloat_Gt(t *testing.T) {
	var f semantic.Float
	fn, caps := capture()
	f.SetFilter("score", fn)
	f.Gt(0.5)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, ">", 0.5)
}

func TestFloat_Gte(t *testing.T) {
	var f semantic.Float
	fn, caps := capture()
	f.SetFilter("score", fn)
	f.Gte(0.5)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, ">=", 0.5)
}

func TestFloat_Lt(t *testing.T) {
	var f semantic.Float
	fn, caps := capture()
	f.SetFilter("score", fn)
	f.Lt(1.0)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "<", 1.0)
}

func TestFloat_Lte(t *testing.T) {
	var f semantic.Float
	fn, caps := capture()
	f.SetFilter("score", fn)
	f.Lte(1.0)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "<=", 1.0)
}

func TestFloat_NilFilter_NoPanic(t *testing.T) {
	var f semantic.Float
	f.Eq(1.0)
	f.NotEq(1.0)
	f.Gt(1.0)
	f.Gte(1.0)
	f.Lt(1.0)
	f.Lte(1.0)
}

func TestFloat_OrderKey(t *testing.T) {
	var f semantic.Float
	f.SetFilter("weight", nil)
	if f.OrderKey() != "weight" {
		t.Fatalf("got %q", f.OrderKey())
	}
}

// ===========================================================================
// Bool
// ===========================================================================

func TestBool_ZeroValue(t *testing.T) {
	var b semantic.Bool
	if b.Value() {
		t.Fatal("zero value should be false")
	}
}

func TestBool_SetTrue(t *testing.T) {
	var b semantic.Bool
	b.Set(true)
	if !b.Value() {
		t.Fatal("expected true")
	}
}

func TestBool_SetFalseAfterTrue(t *testing.T) {
	var b semantic.Bool
	b.Set(true)
	b.Set(false)
	if b.Value() {
		t.Fatal("expected false")
	}
}

func TestBool_New(t *testing.T) {
	if !semantic.NewBool(true).Value() {
		t.Fatal("NewBool failed")
	}
}

func TestBool_EqTrue(t *testing.T) {
	var b semantic.Bool
	fn, caps := capture()
	b.SetFilter("active", fn)
	b.Eq(true)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "=", true)
}

func TestBool_EqFalse(t *testing.T) {
	var b semantic.Bool
	fn, caps := capture()
	b.SetFilter("deleted", fn)
	b.Eq(false)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "=", false)
}

func TestBool_NilFilter_NoPanic(t *testing.T) {
	var b semantic.Bool
	b.Eq(true)
}

// ===========================================================================
// ID
// ===========================================================================

func TestID_ZeroValue(t *testing.T) {
	var id semantic.ID
	if id.Value() != "" {
		t.Fatalf("got %q", id.Value())
	}
}

func TestID_Set(t *testing.T) {
	var id semantic.ID
	id.Set("01932b4e-dead-beef-cafe-000000000001")
	if id.Value() != "01932b4e-dead-beef-cafe-000000000001" {
		t.Fatalf("got %q", id.Value())
	}
}

func TestID_New(t *testing.T) {
	if semantic.NewID("abc").Value() != "abc" {
		t.Fatal("NewID failed")
	}
}

func TestID_Eq(t *testing.T) {
	var id semantic.ID
	fn, caps := capture()
	id.SetFilter("owner_id", fn)
	id.Eq("user-99")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "=", "user-99")
}

func TestID_NotEq(t *testing.T) {
	var id semantic.ID
	fn, caps := capture()
	id.SetFilter("owner_id", fn)
	id.NotEq("deleted-user")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "!=", "deleted-user")
}

func TestID_In(t *testing.T) {
	var id semantic.ID
	fn, caps := capture()
	id.SetFilter("account_id", fn)
	id.In("a", "b", "c")
	assertLen(t, caps, 1)
	if (*caps)[0].op != "IN" {
		t.Fatalf("op: %q", (*caps)[0].op)
	}
	vals, ok := (*caps)[0].val.([]string)
	if !ok || len(vals) != 3 {
		t.Fatalf("val: %+v", (*caps)[0].val)
	}
}

func TestID_NilFilter_NoPanic(t *testing.T) {
	var id semantic.ID
	id.Eq("x")
	id.NotEq("x")
	id.In("x", "y")
}

func TestID_OrderKey(t *testing.T) {
	var id semantic.ID
	id.SetFilter("user_id", nil)
	if id.OrderKey() != "user_id" {
		t.Fatalf("got %q", id.OrderKey())
	}
}

// ===========================================================================
// Email
// ===========================================================================

func TestEmail_ZeroValue(t *testing.T) {
	var e semantic.Email
	if e.Value() != "" {
		t.Fatal("expected empty")
	}
}

func TestEmail_Set(t *testing.T) {
	var e semantic.Email
	e.Set("user@example.com")
	if e.Value() != "user@example.com" {
		t.Fatalf("got %q", e.Value())
	}
}

func TestEmail_New(t *testing.T) {
	if semantic.NewEmail("x@x.io").Value() != "x@x.io" {
		t.Fatal("NewEmail failed")
	}
}

func TestEmail_Eq(t *testing.T) {
	var e semantic.Email
	fn, caps := capture()
	e.SetFilter("email", fn)
	e.Eq("a@b.com")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "=", "a@b.com")
}

func TestEmail_Contains(t *testing.T) {
	var e semantic.Email
	fn, caps := capture()
	e.SetFilter("email", fn)
	e.Contains("@gmail")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "LIKE", "%@gmail%")
}

func TestEmail_NilFilter_NoPanic(t *testing.T) {
	var e semantic.Email
	e.Eq("x@x.com")
	e.Contains("@")
}

func TestEmail_OrderKey(t *testing.T) {
	var e semantic.Email
	e.SetFilter("email", nil)
	if e.OrderKey() != "email" {
		t.Fatalf("got %q", e.OrderKey())
	}
}

// ===========================================================================
// Currency
// ===========================================================================

func TestCurrency_ZeroValue(t *testing.T) {
	var c semantic.Currency
	if c.Value() != 0 {
		t.Fatalf("got %d", c.Value())
	}
}

func TestCurrency_Set(t *testing.T) {
	var c semantic.Currency
	c.Set(10000)
	if c.Value() != 10000 {
		t.Fatalf("got %d", c.Value())
	}
}

func TestCurrency_SetNegative(t *testing.T) {
	var c semantic.Currency
	c.Set(-500)
	if c.Value() != -500 {
		t.Fatalf("got %d", c.Value())
	}
}

func TestCurrency_MaxInt64(t *testing.T) {
	const max = int64(^uint64(0) >> 1)
	var c semantic.Currency
	c.Set(max)
	if c.Value() != max {
		t.Fatal("max int64 round-trip failed")
	}
}

func TestCurrency_New(t *testing.T) {
	if semantic.NewCurrency(250).Value() != 250 {
		t.Fatal("NewCurrency failed")
	}
}

func TestCurrency_Eq(t *testing.T) {
	var c semantic.Currency
	fn, caps := capture()
	c.SetFilter("balance", fn)
	c.Eq(100)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "=", int64(100))
}

func TestCurrency_NotEq(t *testing.T) {
	var c semantic.Currency
	fn, caps := capture()
	c.SetFilter("balance", fn)
	c.NotEq(0)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "!=", int64(0))
}

func TestCurrency_Gt(t *testing.T) {
	var c semantic.Currency
	fn, caps := capture()
	c.SetFilter("amount", fn)
	c.Gt(0)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, ">", int64(0))
}

func TestCurrency_Gte(t *testing.T) {
	var c semantic.Currency
	fn, caps := capture()
	c.SetFilter("amount", fn)
	c.Gte(1)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, ">=", int64(1))
}

func TestCurrency_Lt(t *testing.T) {
	var c semantic.Currency
	fn, caps := capture()
	c.SetFilter("fee", fn)
	c.Lt(999)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "<", int64(999))
}

func TestCurrency_Lte(t *testing.T) {
	var c semantic.Currency
	fn, caps := capture()
	c.SetFilter("fee", fn)
	c.Lte(1000)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "<=", int64(1000))
}

func TestCurrency_Range(t *testing.T) {
	var c semantic.Currency
	fn, caps := capture()
	c.SetFilter("price", fn)
	c.Gte(100)
	c.Lte(500)
	assertLen(t, caps, 2)
}

func TestCurrency_NilFilter_NoPanic(t *testing.T) {
	var c semantic.Currency
	c.Eq(1)
	c.NotEq(1)
	c.Gt(1)
	c.Gte(1)
	c.Lt(1)
	c.Lte(1)
}

func TestCurrency_OrderKey(t *testing.T) {
	var c semantic.Currency
	c.SetFilter("daily_limit", nil)
	if c.OrderKey() != "daily_limit" {
		t.Fatalf("got %q", c.OrderKey())
	}
}

// ===========================================================================
// Enum
// ===========================================================================

func TestEnum_ZeroValue(t *testing.T) {
	var e semantic.Enum
	if e.Value() != "" {
		t.Fatal("expected empty")
	}
}

func TestEnum_Set(t *testing.T) {
	var e semantic.Enum
	e.Set("pending")
	if e.Value() != "pending" {
		t.Fatalf("got %q", e.Value())
	}
}

func TestEnum_SetOverwrite(t *testing.T) {
	var e semantic.Enum
	e.Set("pending")
	e.Set("completed")
	if e.Value() != "completed" {
		t.Fatalf("got %q", e.Value())
	}
}

func TestEnum_New(t *testing.T) {
	if semantic.NewEnum("failed").Value() != "failed" {
		t.Fatal("NewEnum failed")
	}
}

func TestEnum_Eq(t *testing.T) {
	var e semantic.Enum
	fn, caps := capture()
	e.SetFilter("status", fn)
	e.Eq("completed")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "=", "completed")
}

func TestEnum_NotEq(t *testing.T) {
	var e semantic.Enum
	fn, caps := capture()
	e.SetFilter("status", fn)
	e.NotEq("failed")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "!=", "failed")
}

func TestEnum_In(t *testing.T) {
	var e semantic.Enum
	fn, caps := capture()
	e.SetFilter("status", fn)
	e.In("pending", "processing")
	assertLen(t, caps, 1)
	if (*caps)[0].op != "IN" {
		t.Fatalf("op: %q", (*caps)[0].op)
	}
	vals, ok := (*caps)[0].val.([]string)
	if !ok || len(vals) != 2 {
		t.Fatalf("val: %+v", (*caps)[0].val)
	}
}

func TestEnum_NilFilter_NoPanic(t *testing.T) {
	var e semantic.Enum
	e.Eq("x")
	e.NotEq("x")
	e.In("x", "y")
}

// ===========================================================================
// JSON
// ===========================================================================

func TestJSON_ZeroValue(t *testing.T) {
	var j semantic.JSON
	if j.Value() != "" {
		t.Fatal("expected empty")
	}
}

func TestJSON_SetObject(t *testing.T) {
	var j semantic.JSON
	j.Set(`{"key":"value"}`)
	if j.Value() != `{"key":"value"}` {
		t.Fatalf("got %q", j.Value())
	}
}

func TestJSON_SetArray(t *testing.T) {
	var j semantic.JSON
	j.Set(`[1,2,3]`)
	if j.Value() != `[1,2,3]` {
		t.Fatalf("got %q", j.Value())
	}
}

func TestJSON_SetNull(t *testing.T) {
	var j semantic.JSON
	j.Set("null")
	if j.Value() != "null" {
		t.Fatalf("got %q", j.Value())
	}
}

func TestJSON_Contains(t *testing.T) {
	var j semantic.JSON
	fn, caps := capture()
	j.SetFilter("metadata", fn)
	j.Contains(`{"active":true}`)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "@>", `{"active":true}`)
}

func TestJSON_HasKey(t *testing.T) {
	var j semantic.JSON
	fn, caps := capture()
	j.SetFilter("metadata", fn)
	j.HasKey("profile")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "?", "profile")
}

func TestJSON_NilFilter_NoPanic(t *testing.T) {
	var j semantic.JSON
	j.Contains("{}")
	j.HasKey("k")
}

// ===========================================================================
// URL
// ===========================================================================

func TestURL_ZeroValue(t *testing.T) {
	var u semantic.URL
	if u.Value() != "" {
		t.Fatal("expected empty")
	}
}

func TestURL_Set(t *testing.T) {
	var u semantic.URL
	u.Set("https://example.com/path?q=1")
	if u.Value() != "https://example.com/path?q=1" {
		t.Fatalf("got %q", u.Value())
	}
}

func TestURL_Eq(t *testing.T) {
	var u semantic.URL
	fn, caps := capture()
	u.SetFilter("avatar", fn)
	u.Eq("https://cdn.example.com/img.png")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "=", "https://cdn.example.com/img.png")
}

func TestURL_Contains(t *testing.T) {
	var u semantic.URL
	fn, caps := capture()
	u.SetFilter("website", fn)
	u.Contains("github.com")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "LIKE", "%github.com%")
}

func TestURL_NilFilter_NoPanic(t *testing.T) {
	var u semantic.URL
	u.Eq("http://x.com")
	u.Contains("x")
}

func TestURL_OrderKey(t *testing.T) {
	var u semantic.URL
	u.SetFilter("website", nil)
	if u.OrderKey() != "website" {
		t.Fatalf("got %q", u.OrderKey())
	}
}

// ===========================================================================
// Phone
// ===========================================================================

func TestPhone_ZeroValue(t *testing.T) {
	var p semantic.Phone
	if p.Value() != "" {
		t.Fatal("expected empty")
	}
}

func TestPhone_Set(t *testing.T) {
	var p semantic.Phone
	p.Set("+90 532 000 00 00")
	if p.Value() != "+90 532 000 00 00" {
		t.Fatalf("got %q", p.Value())
	}
}

func TestPhone_Eq(t *testing.T) {
	var p semantic.Phone
	fn, caps := capture()
	p.SetFilter("phone", fn)
	p.Eq("+905320000000")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "=", "+905320000000")
}

func TestPhone_StartsWith(t *testing.T) {
	var p semantic.Phone
	fn, caps := capture()
	p.SetFilter("phone", fn)
	p.StartsWith("+90")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "LIKE", "+90%")
}

func TestPhone_NilFilter_NoPanic(t *testing.T) {
	var p semantic.Phone
	p.Eq("+1")
	p.StartsWith("+1")
}

// ===========================================================================
// UUID
// ===========================================================================

func TestUUID_ZeroValue(t *testing.T) {
	var u semantic.UUID
	if u.Value() != "" {
		t.Fatal("expected empty")
	}
}

func TestUUID_Set(t *testing.T) {
	const v = "550e8400-e29b-41d4-a716-446655440000"
	var u semantic.UUID
	u.Set(v)
	if u.Value() != v {
		t.Fatalf("got %q", u.Value())
	}
}

func TestUUID_Eq(t *testing.T) {
	const v = "550e8400-e29b-41d4-a716-446655440000"
	var u semantic.UUID
	fn, caps := capture()
	u.SetFilter("external_id", fn)
	u.Eq(v)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "=", v)
}

func TestUUID_In(t *testing.T) {
	var u semantic.UUID
	fn, caps := capture()
	u.SetFilter("ref_id", fn)
	u.In("a-b-c", "d-e-f")
	assertLen(t, caps, 1)
	if (*caps)[0].op != "IN" {
		t.Fatalf("op: %q", (*caps)[0].op)
	}
}

func TestUUID_NilFilter_NoPanic(t *testing.T) {
	var u semantic.UUID
	u.Eq("x")
	u.In("x", "y")
}

// ===========================================================================
// Color
// ===========================================================================

func TestColor_ZeroValue(t *testing.T) {
	var c semantic.Color
	if c.Value() != "" {
		t.Fatal("expected empty")
	}
}

func TestColor_Set(t *testing.T) {
	var c semantic.Color
	c.Set("#ff5733")
	if c.Value() != "#ff5733" {
		t.Fatalf("got %q", c.Value())
	}
}

func TestColor_Eq(t *testing.T) {
	var c semantic.Color
	fn, caps := capture()
	c.SetFilter("brand_color", fn)
	c.Eq("#ffffff")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "=", "#ffffff")
}

func TestColor_NilFilter_NoPanic(t *testing.T) {
	var c semantic.Color
	c.Eq("#000")
}

// ===========================================================================
// Locale
// ===========================================================================

func TestLocale_ZeroValue(t *testing.T) {
	var l semantic.Locale
	if l.Value() != "" {
		t.Fatal("expected empty")
	}
}

func TestLocale_Set(t *testing.T) {
	var l semantic.Locale
	l.Set("tr-TR")
	if l.Value() != "tr-TR" {
		t.Fatalf("got %q", l.Value())
	}
}

func TestLocale_Eq(t *testing.T) {
	var l semantic.Locale
	fn, caps := capture()
	l.SetFilter("locale", fn)
	l.Eq("en-US")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "=", "en-US")
}

func TestLocale_In(t *testing.T) {
	var l semantic.Locale
	fn, caps := capture()
	l.SetFilter("locale", fn)
	l.In("en-US", "tr-TR", "de-DE")
	assertLen(t, caps, 1)
	if (*caps)[0].op != "IN" {
		t.Fatalf("op: %q", (*caps)[0].op)
	}
	vals, ok := (*caps)[0].val.([]string)
	if !ok || len(vals) != 3 {
		t.Fatalf("val: %+v", (*caps)[0].val)
	}
}

func TestLocale_NilFilter_NoPanic(t *testing.T) {
	var l semantic.Locale
	l.Eq("tr-TR")
	l.In("tr-TR", "en-US")
}

// ===========================================================================
// IBAN
// ===========================================================================

func TestIBAN_ZeroValue(t *testing.T) {
	var i semantic.IBAN
	if i.Value() != "" {
		t.Fatal("expected empty")
	}
}

func TestIBAN_Set(t *testing.T) {
	const v = "TR330006100519786457841326"
	var i semantic.IBAN
	i.Set(v)
	if i.Value() != v {
		t.Fatalf("got %q", i.Value())
	}
}

func TestIBAN_Eq(t *testing.T) {
	const v = "TR330006100519786457841326"
	var i semantic.IBAN
	fn, caps := capture()
	i.SetFilter("iban", fn)
	i.Eq(v)
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "=", v)
}

func TestIBAN_NilFilter_NoPanic(t *testing.T) {
	var i semantic.IBAN
	i.Eq("TR00")
}

// ===========================================================================
// IP
// ===========================================================================

func TestIP_ZeroValue(t *testing.T) {
	var ip semantic.IP
	if ip.Value() != "" {
		t.Fatal("expected empty")
	}
}

func TestIP_SetIPv4(t *testing.T) {
	var ip semantic.IP
	ip.Set("192.168.1.1")
	if ip.Value() != "192.168.1.1" {
		t.Fatalf("got %q", ip.Value())
	}
}

func TestIP_SetIPv6(t *testing.T) {
	var ip semantic.IP
	ip.Set("2001:db8::1")
	if ip.Value() != "2001:db8::1" {
		t.Fatalf("got %q", ip.Value())
	}
}

func TestIP_SetLoopback(t *testing.T) {
	var ip semantic.IP
	ip.Set("::1")
	if ip.Value() != "::1" {
		t.Fatalf("got %q", ip.Value())
	}
}

func TestIP_Eq(t *testing.T) {
	var ip semantic.IP
	fn, caps := capture()
	ip.SetFilter("remote_ip", fn)
	ip.Eq("10.0.0.1")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "=", "10.0.0.1")
}

func TestIP_ContainedBy(t *testing.T) {
	var ip semantic.IP
	fn, caps := capture()
	ip.SetFilter("remote_ip", fn)
	ip.ContainedBy("10.0.0.0/8")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "<<=", "10.0.0.0/8")
}

func TestIP_NilFilter_NoPanic(t *testing.T) {
	var ip semantic.IP
	ip.Eq("1.2.3.4")
	ip.ContainedBy("10.0.0.0/8")
}

// ===========================================================================
// Coordinate
// ===========================================================================

func TestCoordinate_ZeroValue(t *testing.T) {
	var c semantic.Coordinate
	if c.Value() != "" {
		t.Fatal("expected empty")
	}
}

func TestCoordinate_Set(t *testing.T) {
	var c semantic.Coordinate
	c.Set("(41.0082,28.9784)")
	if c.Value() != "(41.0082,28.9784)" {
		t.Fatalf("got %q", c.Value())
	}
}

func TestCoordinate_Eq(t *testing.T) {
	var c semantic.Coordinate
	fn, caps := capture()
	c.SetFilter("location", fn)
	c.Eq("(0,0)")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "=", "(0,0)")
}

func TestCoordinate_Near(t *testing.T) {
	var c semantic.Coordinate
	fn, caps := capture()
	c.SetFilter("location", fn)
	c.Near(41.0082, 28.9784, 1000)
	assertLen(t, caps, 1)
	if (*caps)[0].op != "@NEAR" {
		t.Fatalf("op: %q", (*caps)[0].op)
	}
	cf, ok := (*caps)[0].val.(semantic.CoordinateFilter)
	if !ok {
		t.Fatalf("val type: %T", (*caps)[0].val)
	}
	if cf.Lat != 41.0082 || cf.Lon != 28.9784 || cf.Radius != 1000 {
		t.Fatalf("val: %+v", cf)
	}
}

func TestCoordinate_WithinBox(t *testing.T) {
	var c semantic.Coordinate
	fn, caps := capture()
	c.SetFilter("location", fn)
	c.WithinBox(40.0, 28.0, 42.0, 30.0)
	assertLen(t, caps, 1)
	if (*caps)[0].op != "@BOX" {
		t.Fatalf("op: %q", (*caps)[0].op)
	}
	bf, ok := (*caps)[0].val.(semantic.BoxFilter)
	if !ok {
		t.Fatalf("val type: %T", (*caps)[0].val)
	}
	if bf.MinLat != 40.0 || bf.MinLon != 28.0 || bf.MaxLat != 42.0 || bf.MaxLon != 30.0 {
		t.Fatalf("val: %+v", bf)
	}
}

func TestCoordinate_NilFilter_NoPanic(t *testing.T) {
	var c semantic.Coordinate
	c.Eq("(0,0)")
	c.Near(0, 0, 100)
	c.WithinBox(0, 0, 1, 1)
}

// ===========================================================================
// Date
// ===========================================================================

func TestDate_ZeroValue(t *testing.T) {
	var d semantic.Date
	if d.Value() != "" {
		t.Fatal("expected empty")
	}
}

func TestDate_Set(t *testing.T) {
	var d semantic.Date
	d.Set("2025-05-25")
	if d.Value() != "2025-05-25" {
		t.Fatalf("got %q", d.Value())
	}
}

func TestDate_Eq(t *testing.T) {
	var d semantic.Date
	fn, caps := capture()
	d.SetFilter("birth_date", fn)
	d.Eq("1990-01-15")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "=", "1990-01-15")
}

func TestDate_Gt(t *testing.T) {
	var d semantic.Date
	fn, caps := capture()
	d.SetFilter("expires_at", fn)
	d.Gt("2024-01-01")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, ">", "2024-01-01")
}

func TestDate_Gte(t *testing.T) {
	var d semantic.Date
	fn, caps := capture()
	d.SetFilter("created_date", fn)
	d.Gte("2024-01-01")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, ">=", "2024-01-01")
}

func TestDate_Lt(t *testing.T) {
	var d semantic.Date
	fn, caps := capture()
	d.SetFilter("expires_at", fn)
	d.Lt("2030-12-31")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "<", "2030-12-31")
}

func TestDate_Lte(t *testing.T) {
	var d semantic.Date
	fn, caps := capture()
	d.SetFilter("expires_at", fn)
	d.Lte("2030-12-31")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "<=", "2030-12-31")
}

func TestDate_Range(t *testing.T) {
	var d semantic.Date
	fn, caps := capture()
	d.SetFilter("date", fn)
	d.Gte("2024-01-01")
	d.Lte("2024-12-31")
	assertLen(t, caps, 2)
	if (*caps)[0].op != ">=" || (*caps)[1].op != "<=" {
		t.Fatalf("ops: %+v", *caps)
	}
}

func TestDate_NilFilter_NoPanic(t *testing.T) {
	var d semantic.Date
	d.Eq("2025-01-01")
	d.Gt("2025-01-01")
	d.Gte("2025-01-01")
	d.Lt("2025-01-01")
	d.Lte("2025-01-01")
}

func TestDate_OrderKey(t *testing.T) {
	var d semantic.Date
	d.SetFilter("birth_date", nil)
	if d.OrderKey() != "birth_date" {
		t.Fatalf("got %q", d.OrderKey())
	}
}

// ===========================================================================
// Timestamp
// ===========================================================================

func TestTimestamp_ZeroValue(t *testing.T) {
	var ts semantic.Timestamp
	if ts.Value() != "" {
		t.Fatal("expected empty")
	}
}

func TestTimestamp_Set(t *testing.T) {
	var ts semantic.Timestamp
	ts.Set("2025-05-25T12:00:00Z")
	if ts.Value() != "2025-05-25T12:00:00Z" {
		t.Fatalf("got %q", ts.Value())
	}
}

func TestTimestamp_Eq(t *testing.T) {
	var ts semantic.Timestamp
	fn, caps := capture()
	ts.SetFilter("created_at", fn)
	ts.Eq("2025-01-01T00:00:00Z")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "=", "2025-01-01T00:00:00Z")
}

func TestTimestamp_Gt(t *testing.T) {
	var ts semantic.Timestamp
	fn, caps := capture()
	ts.SetFilter("created_at", fn)
	ts.Gt("2024-01-01T00:00:00Z")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, ">", "2024-01-01T00:00:00Z")
}

func TestTimestamp_Gte(t *testing.T) {
	var ts semantic.Timestamp
	fn, caps := capture()
	ts.SetFilter("updated_at", fn)
	ts.Gte("2024-06-01T00:00:00Z")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, ">=", "2024-06-01T00:00:00Z")
}

func TestTimestamp_Lt(t *testing.T) {
	var ts semantic.Timestamp
	fn, caps := capture()
	ts.SetFilter("deleted_at", fn)
	ts.Lt("2099-01-01T00:00:00Z")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "<", "2099-01-01T00:00:00Z")
}

func TestTimestamp_Lte(t *testing.T) {
	var ts semantic.Timestamp
	fn, caps := capture()
	ts.SetFilter("deleted_at", fn)
	ts.Lte("2099-01-01T00:00:00Z")
	assertLen(t, caps, 1)
	assertCap(t, caps, 0, "<=", "2099-01-01T00:00:00Z")
}

func TestTimestamp_Range(t *testing.T) {
	var ts semantic.Timestamp
	fn, caps := capture()
	ts.SetFilter("created_at", fn)
	ts.Gte("2025-01-01T00:00:00Z")
	ts.Lt("2026-01-01T00:00:00Z")
	assertLen(t, caps, 2)
	if (*caps)[0].op != ">=" || (*caps)[1].op != "<" {
		t.Fatalf("ops: %+v", *caps)
	}
}

func TestTimestamp_NilFilter_NoPanic(t *testing.T) {
	var ts semantic.Timestamp
	ts.Eq("t")
	ts.Gt("t")
	ts.Gte("t")
	ts.Lt("t")
	ts.Lte("t")
}

func TestTimestamp_OrderKey(t *testing.T) {
	var ts semantic.Timestamp
	ts.SetFilter("created_at", nil)
	if ts.OrderKey() != "created_at" {
		t.Fatalf("got %q", ts.OrderKey())
	}
}

// ===========================================================================
// Cross-type & SetFilter edge cases
// ===========================================================================

func TestSetFilter_NilFnKeyPersists(t *testing.T) {
	var s semantic.String
	s.SetFilter("my_field", nil)
	if s.OrderKey() != "my_field" {
		t.Fatalf("key not persisted: got %q", s.OrderKey())
	}
	s.Eq("x") // must not panic
}

func TestSetFilter_ReplaceFn(t *testing.T) {
	var s semantic.String
	fn1, caps1 := capture()
	fn2, caps2 := capture()
	s.SetFilter("f", fn1)
	s.Eq("a")
	s.SetFilter("f", fn2)
	s.Eq("b")
	assertLen(t, caps1, 1)
	assertLen(t, caps2, 1)
	if (*caps2)[0].val != "b" {
		t.Fatalf("fn2 wrong val: %v", (*caps2)[0].val)
	}
}

func TestFilter_MultipleFieldsIndependent(t *testing.T) {
	var s semantic.String
	var i semantic.Int
	sFn, sCaps := capture()
	iFn, iCaps := capture()
	s.SetFilter("name", sFn)
	i.SetFilter("age", iFn)
	s.Eq("bob")
	i.Gte(18)
	i.Lte(65)
	assertLen(t, sCaps, 1)
	assertLen(t, iCaps, 2)
}

func TestFilter_SameFieldMultipleOps(t *testing.T) {
	var c semantic.Currency
	fn, caps := capture()
	c.SetFilter("amount", fn)
	c.Gte(100)
	c.Lte(9999)
	c.NotEq(500)
	assertLen(t, caps, 3)
	if (*caps)[0].op != ">=" || (*caps)[1].op != "<=" || (*caps)[2].op != "!=" {
		t.Fatalf("ops: %+v", *caps)
	}
}
