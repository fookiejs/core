package semantic

func NewString(v string) String      { return String{textCore: textCore{val: v}} }
func NewInt(v int64) Int             { return Int{intCore: intCore{val: v}} }
func NewFloat(v float64) Float       { return Float{floatCore: floatCore{val: v}} }
func NewBool(v bool) Bool            { return Bool{boolCore: boolCore{val: v}} }
func NewID(v string) ID              { return ID{textCore: textCore{val: v}} }
func NewEmail(v string) Email        { return Email{textCore: textCore{val: v}} }
func NewCurrency(v int64) Currency   { return Currency{intCore: intCore{val: v}} }
func NewIBAN(v string) IBAN          { return IBAN{textCore: textCore{val: v}} }
func NewEnum[T ~string](v T) Enum[T] { return Enum[T]{textCore: textCore{val: string(v)}} }

type String struct {
	textCore
}

func (s *String) Set(v string) { s.val = v }
func (s String) Value() string { return s.val }

func (s String) Eq(v string) {
	s.fn("=", FilterText(v))
}

func (s String) NotEq(v string) {
	s.fn("!=", FilterText(v))
}

func (s String) Contains(v string) {
	s.fn("LIKE", FilterText("%"+v+"%"))
}

func (s String) StartsWith(v string) {
	s.fn("LIKE", FilterText(v+"%"))
}

func (s String) EndsWith(v string) {
	s.fn("LIKE", FilterText("%"+v))
}

func (s String) In(vals ...string) {
	s.fn("IN", FilterTexts(vals))
}

type Int struct {
	intCore
	validators []intValidator
}

func (i *Int) Set(v int64) { i.val = v }
func (i Int) Value() int64 { return i.val }

func (i Int) Eq(v int64) {
	i.fn("=", FilterInteger(v))
}

func (i Int) NotEq(v int64) {
	i.fn("!=", FilterInteger(v))
}

func (i Int) Gt(v int64) {
	i.fn(">", FilterInteger(v))
}

func (i Int) Gte(v int64) {
	i.fn(">=", FilterInteger(v))
}

func (i Int) Lt(v int64) {
	i.fn("<", FilterInteger(v))
}

func (i Int) Lte(v int64) {
	i.fn("<=", FilterInteger(v))
}

func (i Int) In(vals ...int64) {
	i.fn("IN", FilterIntegers(vals))
}

func (i *Int) Min(v int64) *Int {
	i.validators = append(i.validators, intMin(v))
	return i
}

func (i *Int) Max(v int64) *Int {
	i.validators = append(i.validators, intMax(v))
	return i
}

func (i Int) ValidateField(field string) error {
	for _, fn := range i.validators {
		if err := fn(field, i.val); err != nil {
			return err
		}
	}
	return nil
}

func (i *Int) ApplyTag(part string, schema *SchemaFlags) bool {
	if ApplySchemaTag(part, schema) {
		return true
	}
	if v, ok := ParseMinTag(part); ok {
		i.Min(v)
		return true
	}
	if v, ok := ParseMaxTag(part); ok {
		i.Max(v)
		return true
	}
	return false
}

type Float struct {
	floatCore
	validators []floatValidator
}

func (f *Float) Set(v float64) { f.val = v }
func (f Float) Value() float64 { return f.val }

func (f Float) Eq(v float64) {
	f.fn("=", FilterNumber(v))
}

func (f Float) NotEq(v float64) {
	f.fn("!=", FilterNumber(v))
}

func (f Float) Gt(v float64) {
	f.fn(">", FilterNumber(v))
}

func (f Float) Gte(v float64) {
	f.fn(">=", FilterNumber(v))
}

func (f Float) Lt(v float64) {
	f.fn("<", FilterNumber(v))
}

func (f Float) Lte(v float64) {
	f.fn("<=", FilterNumber(v))
}

func (f *Float) Min(v float64) *Float {
	f.validators = append(f.validators, floatMin(v))
	return f
}

func (f *Float) Max(v float64) *Float {
	f.validators = append(f.validators, floatMax(v))
	return f
}

func (f Float) ValidateField(field string) error {
	for _, fn := range f.validators {
		if err := fn(field, f.val); err != nil {
			return err
		}
	}
	return nil
}

func (f *Float) ApplyTag(part string, schema *SchemaFlags) bool {
	if ApplySchemaTag(part, schema) {
		return true
	}
	if v, ok := ParseMinFloatTag(part); ok {
		f.Min(v)
		return true
	}
	if v, ok := ParseMaxFloatTag(part); ok {
		f.Max(v)
		return true
	}
	return false
}

type Bool struct {
	boolCore
}

func (b *Bool) Set(v bool) { b.val = v }
func (b Bool) Value() bool { return b.val }

func (b Bool) Eq(v bool) {
	b.fn("=", FilterTruth(v))
}

type JSON struct {
	textCore
}

func (j *JSON) Set(v string) { j.val = v }
func (j JSON) Value() string { return j.val }

func (j JSON) Contains(v string) {
	j.fn("@>", FilterText(v))
}

func (j JSON) HasKey(k string) {
	j.fn("?", FilterText(k))
}

type ID struct {
	textCore
}

func (i *ID) Set(v string) { i.val = v }
func (i ID) Value() string { return i.val }

func (i ID) Eq(v string) {
	i.fn("=", FilterText(v))
}

func (i ID) NotEq(v string) {
	i.fn("!=", FilterText(v))
}

func (i ID) In(vals ...string) {
	i.fn("IN", FilterTexts(vals))
}

type Email struct {
	textCore
}

func (e *Email) Set(v string) { e.val = v }
func (e Email) Value() string { return e.val }

func (e Email) Eq(v string) {
	e.fn("=", FilterText(v))
}

func (e Email) Contains(v string) {
	e.fn("LIKE", FilterText("%"+v+"%"))
}

type URL struct {
	textCore
}

func (u *URL) Set(v string) { u.val = v }
func (u URL) Value() string { return u.val }

func (u URL) Eq(v string) {
	u.fn("=", FilterText(v))
}

func (u URL) Contains(v string) {
	u.fn("LIKE", FilterText("%"+v+"%"))
}

type Phone struct {
	textCore
}

func (p *Phone) Set(v string) { p.val = v }
func (p Phone) Value() string { return p.val }

func (p Phone) Eq(v string) {
	p.fn("=", FilterText(v))
}

func (p Phone) StartsWith(v string) {
	p.fn("LIKE", FilterText(v+"%"))
}

type UUID struct {
	textCore
}

func (u *UUID) Set(v string) { u.val = v }
func (u UUID) Value() string { return u.val }

func (u UUID) Eq(v string) {
	u.fn("=", FilterText(v))
}

func (u UUID) In(vals ...string) {
	u.fn("IN", FilterTexts(vals))
}

type Color struct {
	textCore
}

func (c *Color) Set(v string) { c.val = v }
func (c Color) Value() string { return c.val }

func (c Color) Eq(v string) {
	c.fn("=", FilterText(v))
}

type Locale struct {
	textCore
}

func (l *Locale) Set(v string) { l.val = v }
func (l Locale) Value() string { return l.val }

func (l Locale) Eq(v string) {
	l.fn("=", FilterText(v))
}

func (l Locale) In(vals ...string) {
	l.fn("IN", FilterTexts(vals))
}

type IBAN struct {
	textCore
}

func (i *IBAN) Set(v string) { i.val = v }
func (i IBAN) Value() string { return i.val }

func (i IBAN) Eq(v string) {
	i.fn("=", FilterText(v))
}

type IP struct {
	textCore
}

func (i *IP) Set(v string) { i.val = v }
func (i IP) Value() string { return i.val }

func (i IP) Eq(v string) {
	i.fn("=", FilterText(v))
}

func (i IP) ContainedBy(cidr string) {
	i.fn("<<=", FilterText(cidr))
}

type CoordinateFilter struct {
	Lat    float64
	Lon    float64
	Radius float64
}

type BoxFilter struct {
	MinLat float64
	MinLon float64
	MaxLat float64
	MaxLon float64
}

type Coordinate struct {
	textCore
}

func (c *Coordinate) Set(v string) { c.val = v }
func (c Coordinate) Value() string { return c.val }

func (c Coordinate) Eq(v string) {
	c.fn("=", FilterText(v))
}

func (c Coordinate) Near(lat, lon, radiusMeters float64) {
	c.fn("@NEAR", CoordinateFilter{Lat: lat, Lon: lon, Radius: radiusMeters})
}

func (c Coordinate) WithinBox(minLat, minLon, maxLat, maxLon float64) {
	c.fn("@BOX", BoxFilter{MinLat: minLat, MinLon: minLon, MaxLat: maxLat, MaxLon: maxLon})
}

type Currency struct {
	intCore
	validators []intValidator
}

func (c *Currency) Set(v int64) { c.val = v }
func (c Currency) Value() int64 { return c.val }

func (c Currency) Eq(v int64) {
	c.fn("=", FilterInteger(v))
}

func (c Currency) NotEq(v int64) {
	c.fn("!=", FilterInteger(v))
}

func (c Currency) Gt(v int64) {
	c.fn(">", FilterInteger(v))
}

func (c Currency) Gte(v int64) {
	c.fn(">=", FilterInteger(v))
}

func (c Currency) Lt(v int64) {
	c.fn("<", FilterInteger(v))
}

func (c Currency) Lte(v int64) {
	c.fn("<=", FilterInteger(v))
}

func (c *Currency) Min(v int64) *Currency {
	c.validators = append(c.validators, intMin(v))
	return c
}

func (c *Currency) Max(v int64) *Currency {
	c.validators = append(c.validators, intMax(v))
	return c
}

func (c Currency) ValidateField(field string) error {
	for _, fn := range c.validators {
		if err := fn(field, c.val); err != nil {
			return err
		}
	}
	return nil
}

func (c *Currency) ApplyTag(part string, schema *SchemaFlags) bool {
	if ApplySchemaTag(part, schema) {
		return true
	}
	if v, ok := ParseMinTag(part); ok {
		c.Min(v)
		return true
	}
	if v, ok := ParseMaxTag(part); ok {
		c.Max(v)
		return true
	}
	return false
}

type Date struct {
	textCore
}

func (d *Date) Set(v string) { d.val = v }
func (d Date) Value() string { return d.val }

func (d Date) Eq(v string) {
	d.fn("=", FilterText(v))
}

func (d Date) Gt(v string) {
	d.fn(">", FilterText(v))
}

func (d Date) Gte(v string) {
	d.fn(">=", FilterText(v))
}

func (d Date) Lt(v string) {
	d.fn("<", FilterText(v))
}

func (d Date) Lte(v string) {
	d.fn("<=", FilterText(v))
}

type Timestamp struct {
	textCore
}

func (t *Timestamp) Set(v string) { t.val = v }
func (t Timestamp) Value() string { return t.val }

func (t Timestamp) Eq(v string) {
	t.fn("=", FilterText(v))
}

func (t Timestamp) Gt(v string) {
	t.fn(">", FilterText(v))
}

func (t Timestamp) Gte(v string) {
	t.fn(">=", FilterText(v))
}

func (t Timestamp) Lt(v string) {
	t.fn("<", FilterText(v))
}

func (t Timestamp) Lte(v string) {
	t.fn("<=", FilterText(v))
}

type Enum[T ~string] struct {
	textCore
}

func (e *Enum[T]) Set(v T) { e.val = string(v) }
func (e Enum[T]) Value() T { return T(e.val) }

func (e Enum[T]) Eq(v T) {
	e.fn("=", FilterText(string(v)))
}

func (e Enum[T]) NotEq(v T) {
	e.fn("!=", FilterText(string(v)))
}

func (e Enum[T]) In(vals ...T) {
	ss := make([]string, len(vals))
	for i, v := range vals {
		ss[i] = string(v)
	}
	e.fn("IN", FilterTexts(ss))
}

func (String) Kind() Kind     { return StringKind }
func (Int) Kind() Kind        { return Int64Kind }
func (Float) Kind() Kind      { return Float64Kind }
func (Bool) Kind() Kind       { return BoolKind }
func (JSON) Kind() Kind       { return JSONKind }
func (ID) Kind() Kind         { return IDKind }
func (Email) Kind() Kind      { return EmailKind }
func (URL) Kind() Kind        { return URLKind }
func (Phone) Kind() Kind      { return PhoneKind }
func (UUID) Kind() Kind       { return UUIDKind }
func (Color) Kind() Kind      { return ColorKind }
func (Locale) Kind() Kind     { return LocaleKind }
func (IBAN) Kind() Kind       { return IBANKind }
func (IP) Kind() Kind         { return IPKind }
func (Coordinate) Kind() Kind { return CoordinateKind }
func (Currency) Kind() Kind   { return CurrencyKind }
func (Date) Kind() Kind       { return DateKind }
func (Timestamp) Kind() Kind  { return TimestampKind }
func (Enum[T]) Kind() Kind    { return EnumKind }
