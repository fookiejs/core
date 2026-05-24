package semantic

// Constructor helpers

func NewString(v string) String    { return String{val: v} }
func NewInt(v int64) Int           { return Int{val: v} }
func NewFloat(v float64) Float     { return Float{val: v} }
func NewBool(v bool) Bool          { return Bool{val: v} }
func NewID(v string) ID            { return ID{val: v} }
func NewEmail(v string) Email      { return Email{val: v} }
func NewCurrency(v int64) Currency { return Currency{val: v} }
func NewEnum(v string) Enum        { return Enum{val: v} }

// String

type String struct {
	val string
	fn  func(string, any)
	key string
}

func (s *String) Set(v string)                               { s.val = v }
func (s String) Value() string                               { return s.val }
func (s String) Eq(v string)                                 { if s.fn != nil { s.fn("=", v) } }
func (s String) Contains(v string)                           { if s.fn != nil { s.fn("LIKE", "%"+v+"%") } }
func (s String) OrderKey() string                            { return s.key }
func (s *String) SetFilter(key string, fn func(string, any)) { s.key = key; s.fn = fn }

// Int

type Int struct {
	val int64
	fn  func(string, any)
	key string
}

func (i *Int) Set(v int64)                               { i.val = v }
func (i Int) Value() int64                               { return i.val }
func (i Int) Eq(v int64)                                 { if i.fn != nil { i.fn("=", v) } }
func (i Int) Gte(v int64)                                { if i.fn != nil { i.fn(">=", v) } }
func (i Int) Lte(v int64)                                { if i.fn != nil { i.fn("<=", v) } }
func (i Int) OrderKey() string                           { return i.key }
func (i *Int) SetFilter(key string, fn func(string, any)) { i.key = key; i.fn = fn }

// Float

type Float struct {
	val float64
	fn  func(string, any)
	key string
}

func (f *Float) Set(v float64)                               { f.val = v }
func (f Float) Value() float64                               { return f.val }
func (f Float) Gte(v float64)                                { if f.fn != nil { f.fn(">=", v) } }
func (f Float) Lte(v float64)                                { if f.fn != nil { f.fn("<=", v) } }
func (f Float) OrderKey() string                             { return f.key }
func (f *Float) SetFilter(key string, fn func(string, any)) { f.key = key; f.fn = fn }

// Bool

type Bool struct {
	val bool
	fn  func(string, any)
	key string
}

func (b *Bool) Set(v bool)                               { b.val = v }
func (b Bool) Value() bool                               { return b.val }
func (b Bool) Eq(v bool)                                 { if b.fn != nil { b.fn("=", v) } }
func (b *Bool) SetFilter(key string, fn func(string, any)) { b.key = key; b.fn = fn }

// JSON

type JSON struct {
	val string
	fn  func(string, any)
	key string
}

func (j *JSON) Set(v string)                               { j.val = v }
func (j JSON) Value() string                               { return j.val }
func (j *JSON) SetFilter(key string, fn func(string, any)) { j.key = key; j.fn = fn }

// ID

type ID struct {
	val string
	fn  func(string, any)
	key string
}

func (i *ID) Set(v string)                               { i.val = v }
func (i ID) Value() string                               { return i.val }
func (i ID) Eq(v string)                                 { if i.fn != nil { i.fn("=", v) } }
func (i ID) OrderKey() string                            { return i.key }
func (i *ID) SetFilter(key string, fn func(string, any)) { i.key = key; i.fn = fn }

// Email

type Email struct {
	val string
	fn  func(string, any)
	key string
}

func (e *Email) Set(v string)                               { e.val = v }
func (e Email) Value() string                               { return e.val }
func (e Email) Eq(v string)                                 { if e.fn != nil { e.fn("=", v) } }
func (e Email) OrderKey() string                            { return e.key }
func (e *Email) SetFilter(key string, fn func(string, any)) { e.key = key; e.fn = fn }

// URL

type URL struct {
	val string
	fn  func(string, any)
	key string
}

func (u *URL) Set(v string)                               { u.val = v }
func (u URL) Value() string                               { return u.val }
func (u *URL) SetFilter(key string, fn func(string, any)) { u.key = key; u.fn = fn }

// Phone

type Phone struct {
	val string
	fn  func(string, any)
	key string
}

func (p *Phone) Set(v string)                               { p.val = v }
func (p Phone) Value() string                               { return p.val }
func (p *Phone) SetFilter(key string, fn func(string, any)) { p.key = key; p.fn = fn }

// UUID

type UUID struct {
	val string
	fn  func(string, any)
	key string
}

func (u *UUID) Set(v string)                               { u.val = v }
func (u UUID) Value() string                               { return u.val }
func (u *UUID) SetFilter(key string, fn func(string, any)) { u.key = key; u.fn = fn }

// Color

type Color struct {
	val string
	fn  func(string, any)
	key string
}

func (c *Color) Set(v string)                               { c.val = v }
func (c Color) Value() string                               { return c.val }
func (c *Color) SetFilter(key string, fn func(string, any)) { c.key = key; c.fn = fn }

// Locale

type Locale struct {
	val string
	fn  func(string, any)
	key string
}

func (l *Locale) Set(v string)                               { l.val = v }
func (l Locale) Value() string                               { return l.val }
func (l *Locale) SetFilter(key string, fn func(string, any)) { l.key = key; l.fn = fn }

// IBAN

type IBAN struct {
	val string
	fn  func(string, any)
	key string
}

func (i *IBAN) Set(v string)                               { i.val = v }
func (i IBAN) Value() string                               { return i.val }
func (i *IBAN) SetFilter(key string, fn func(string, any)) { i.key = key; i.fn = fn }

// IP

type IP struct {
	val string
	fn  func(string, any)
	key string
}

func (i *IP) Set(v string)                               { i.val = v }
func (i IP) Value() string                               { return i.val }
func (i IP) Eq(v string)                                 { if i.fn != nil { i.fn("=", v) } }
func (i *IP) SetFilter(key string, fn func(string, any)) { i.key = key; i.fn = fn }

// Coordinate

type Coordinate struct {
	val string
	fn  func(string, any)
	key string
}

func (c *Coordinate) Set(v string)                               { c.val = v }
func (c Coordinate) Value() string                               { return c.val }
func (c *Coordinate) SetFilter(key string, fn func(string, any)) { c.key = key; c.fn = fn }

// Currency

type Currency struct {
	val int64
	fn  func(string, any)
	key string
}

func (c *Currency) Set(v int64)                               { c.val = v }
func (c Currency) Value() int64                               { return c.val }
func (c Currency) Eq(v int64)                                 { if c.fn != nil { c.fn("=", v) } }
func (c Currency) Gte(v int64)                                { if c.fn != nil { c.fn(">=", v) } }
func (c Currency) Lte(v int64)                                { if c.fn != nil { c.fn("<=", v) } }
func (c Currency) OrderKey() string                           { return c.key }
func (c *Currency) SetFilter(key string, fn func(string, any)) { c.key = key; c.fn = fn }

// Date

type Date struct {
	val string
	fn  func(string, any)
	key string
}

func (d *Date) Set(v string)                               { d.val = v }
func (d Date) Value() string                               { return d.val }
func (d Date) OrderKey() string                            { return d.key }
func (d *Date) SetFilter(key string, fn func(string, any)) { d.key = key; d.fn = fn }

// Timestamp

type Timestamp struct {
	val string
	fn  func(string, any)
	key string
}

func (t *Timestamp) Set(v string)                               { t.val = v }
func (t Timestamp) Value() string                               { return t.val }
func (t Timestamp) OrderKey() string                            { return t.key }
func (t *Timestamp) SetFilter(key string, fn func(string, any)) { t.key = key; t.fn = fn }

// Enum

type Enum struct {
	val string
	fn  func(string, any)
	key string
}

func (e *Enum) Set(v string)                               { e.val = v }
func (e Enum) Value() string                               { return e.val }
func (e Enum) Eq(v string)                                 { if e.fn != nil { e.fn("=", v) } }
func (e *Enum) SetFilter(key string, fn func(string, any)) { e.key = key; e.fn = fn }
