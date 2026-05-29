package semantic

type textCore struct {
	val string
	fn  FilterFn
	key string
}

func (c *textCore) SetKey(key string)     { c.key = key }
func (c *textCore) SetFilter(fn FilterFn) { c.fn = fn }
func (c textCore) OrderKey() string       { return c.key }
func (c textCore) RowValue() any          { return c.val }
func (c *textCore) RowSet(v any) bool {
	switch x := v.(type) {
	case string:
		c.val = x
		return true
	case []byte:
		c.val = string(x)
		return true
	default:
		return false
	}
}

type intCore struct {
	val int64
	fn  FilterFn
	key string
}

func (c *intCore) SetKey(key string)     { c.key = key }
func (c *intCore) SetFilter(fn FilterFn) { c.fn = fn }
func (c intCore) OrderKey() string       { return c.key }
func (c intCore) RowValue() any          { return c.val }
func (c *intCore) RowSet(v any) bool {
	switch typedValue := v.(type) {
	case int64:
		c.val = typedValue
		return true
	case int32:
		c.val = int64(typedValue)
		return true
	case int:
		c.val = int64(typedValue)
		return true
	default:
		return false
	}
}

type floatCore struct {
	val float64
	fn  FilterFn
	key string
}

func (c *floatCore) SetKey(key string)     { c.key = key }
func (c *floatCore) SetFilter(fn FilterFn) { c.fn = fn }
func (c floatCore) OrderKey() string       { return c.key }
func (c floatCore) RowValue() any          { return c.val }
func (c *floatCore) RowSet(v any) bool {
	switch typedValue := v.(type) {
	case float64:
		c.val = typedValue
		return true
	case float32:
		c.val = float64(typedValue)
		return true
	case int64:
		c.val = float64(typedValue)
		return true
	case int:
		c.val = float64(typedValue)
		return true
	default:
		return false
	}
}

type boolCore struct {
	val bool
	fn  FilterFn
	key string
}

func (c *boolCore) SetKey(key string)     { c.key = key }
func (c *boolCore) SetFilter(fn FilterFn) { c.fn = fn }
func (c boolCore) OrderKey() string       { return c.key }
func (c boolCore) RowValue() any          { return c.val }
func (c *boolCore) RowSet(v any) bool {
	x, ok := v.(bool)
	if !ok {
		return false
	}
	c.val = x
	return true
}
