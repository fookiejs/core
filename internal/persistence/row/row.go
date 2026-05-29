package row

import (
	"encoding/json"
	"fmt"

	"github.com/fookiejs/fookie/semantic"
)

type Kind uint8

const (
	KindEmpty Kind = iota
	KindText
	KindInteger
	KindNumber
	KindTruth
	KindBytes
)

type Map map[string]Cell

type Cell struct {
	Kind    Kind
	Text    string
	Integer int64
	Number  float64
	Truth   bool
	Bytes   []byte
}

func FromText(s string) Cell { return Cell{Kind: KindText, Text: s} }

func FromInteger(n int64) Cell { return Cell{Kind: KindInteger, Integer: n} }

func FromNumber(n float64) Cell { return Cell{Kind: KindNumber, Number: n} }

func FromTruth(b bool) Cell { return Cell{Kind: KindTruth, Truth: b} }

func FromBytes(b []byte) Cell { return Cell{Kind: KindBytes, Bytes: b} }

func EmptyCell() Cell { return Cell{Kind: KindEmpty} }

func FromValue(v any) Cell {
	if v == nil {
		return EmptyCell()
	}
	switch x := v.(type) {
	case string:
		return FromText(x)
	case int64:
		return FromInteger(x)
	case int32:
		return FromInteger(int64(x))
	case int:
		return FromInteger(int64(x))
	case float64:
		return FromNumber(x)
	case float32:
		return FromNumber(float64(x))
	case bool:
		return FromTruth(x)
	case []byte:
		return FromBytes(x)
	default:
		return FromDriver(v)
	}
}

func FromDriver(v any) Cell {
	if v == nil {
		return EmptyCell()
	}
	switch x := v.(type) {
	case string:
		return FromText(x)
	case []byte:
		return FromBytes(x)
	case int64:
		return FromInteger(x)
	case int32:
		return FromInteger(int64(x))
	case int:
		return FromInteger(int64(x))
	case float64:
		return FromNumber(x)
	case float32:
		return FromNumber(float64(x))
	case bool:
		return FromTruth(x)
	default:
		return FromText(jsonString(v))
	}
}

func (c Cell) DriverValue(columnJSON bool) any {
	switch c.Kind {
	case KindEmpty:
		return nil
	case KindText:
		return c.Text
	case KindInteger:
		return c.Integer
	case KindNumber:
		return c.Number
	case KindTruth:
		return c.Truth
	case KindBytes:
		if columnJSON {
			return string(c.Bytes)
		}
		return c.Bytes
	default:
		return nil
	}
}

func (c Cell) String() string {
	if c.Kind == KindEmpty {
		return ""
	}
	switch c.Kind {
	case KindText:
		return c.Text
	case KindInteger:
		return jsonString(c.Integer)
	case KindNumber:
		return jsonString(c.Number)
	case KindTruth:
		return jsonString(c.Truth)
	case KindBytes:
		return string(c.Bytes)
	default:
		return ""
	}
}

func (m Map) MarshalJSON() ([]byte, error) {
	raw := make(map[string]any, len(m))
	for k, c := range m {
		if c.Kind == KindEmpty {
			continue
		}
		raw[k] = c.DriverValue(false)
	}
	return json.Marshal(raw)
}

func (m Map) TextOr(key, fallback string) string {
	c, ok := m[key]
	if !ok || c.Kind != KindText {
		return fallback
	}
	return c.Text
}

func (m Map) RequireText(key string) string {
	c, ok := m[key]
	if !ok || c.Kind != KindText || c.Text == "" {
		panic(fmt.Sprintf("row: required text column %q missing or empty", key))
	}
	return c.Text
}

func FromAnyMap(m map[string]any) Map {
	if m == nil {
		return nil
	}
	out := make(Map, len(m))
	for k, v := range m {
		out[k] = FromDriver(v)
	}
	return out
}

func FilterDriver(v semantic.FilterValue) any {
	switch x := v.(type) {
	case semantic.FilterText:
		return string(x)
	case semantic.FilterTexts:
		return []string(x)
	case semantic.FilterInteger:
		return int64(x)
	case semantic.FilterIntegers:
		return []int64(x)
	case semantic.FilterNumber:
		return float64(x)
	case semantic.FilterTruth:
		return bool(x)
	case semantic.CoordinateFilter:
		return x
	case semantic.BoxFilter:
		return x
	default:
		return v
	}
}

func jsonString(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
