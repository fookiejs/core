package row

import (
	"encoding/json"

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

func FromValue(value any) Cell {
	if value == nil {
		return EmptyCell()
	}
	switch typedValue := value.(type) {
	case string:
		return FromText(typedValue)
	case int64:
		return FromInteger(typedValue)
	case int32:
		return FromInteger(int64(typedValue))
	case int:
		return FromInteger(int64(typedValue))
	case float64:
		return FromNumber(typedValue)
	case float32:
		return FromNumber(float64(typedValue))
	case bool:
		return FromTruth(typedValue)
	case []byte:
		return FromBytes(typedValue)
	default:
		return FromDriver(value)
	}
}

func FromDriver(value any) Cell {
	if value == nil {
		return EmptyCell()
	}
	switch typedValue := value.(type) {
	case string:
		return FromText(typedValue)
	case []byte:
		return FromBytes(typedValue)
	case int64:
		return FromInteger(typedValue)
	case int32:
		return FromInteger(int64(typedValue))
	case int:
		return FromInteger(int64(typedValue))
	case float64:
		return FromNumber(typedValue)
	case float32:
		return FromNumber(float64(typedValue))
	case bool:
		return FromTruth(typedValue)
	default:
		return FromText(jsonString(value))
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

func FromAnyMap(input map[string]any) Values {
	out := make(Values, 0, len(input))
	for key, value := range input {
		out = append(out, Field{Column: key, Cell: FromDriver(value)})
	}
	return out
}

func FilterDriver(value semantic.FilterValue) any {
	switch typedValue := value.(type) {
	case semantic.FilterText:
		return string(typedValue)
	case semantic.FilterTexts:
		return []string(typedValue)
	case semantic.FilterInteger:
		return int64(typedValue)
	case semantic.FilterIntegers:
		return []int64(typedValue)
	case semantic.FilterNumber:
		return float64(typedValue)
	case semantic.FilterTruth:
		return bool(typedValue)
	case semantic.CoordinateFilter:
		return typedValue
	case semantic.BoxFilter:
		return typedValue
	default:
		return value
	}
}

func jsonString(v any) string {
	b, _ := json.Marshal(v)
	return string(b)
}
