package row

import (
	"bytes"
	"encoding/json"
	"fmt"
)

func UnmarshalJSON(data []byte) (Values, error) {
	if len(data) == 0 {
		return Values{}, nil
	}
	decoder := json.NewDecoder(bytes.NewReader(data))
	decoder.UseNumber()
	var raw map[string]json.RawMessage
	if err := decoder.Decode(&raw); err != nil {
		return nil, fmt.Errorf("row: unmarshal: %w", err)
	}
	out := make(Values, 0, len(raw))
	for key, message := range raw {
		out = append(out, Field{Column: key, Cell: cellFromJSON(message)})
	}
	return out, nil
}

func cellFromJSON(message json.RawMessage) Cell {
	if string(message) == "null" {
		return EmptyCell()
	}
	var text string
	if err := json.Unmarshal(message, &text); err == nil {
		return FromText(text)
	}
	var truth bool
	if err := json.Unmarshal(message, &truth); err == nil {
		return FromTruth(truth)
	}
	var number json.Number
	if err := json.Unmarshal(message, &number); err == nil {
		if integer, err := number.Int64(); err == nil {
			return FromInteger(integer)
		}
		if float, err := number.Float64(); err == nil {
			return FromNumber(float)
		}
	}
	return FromBytes(message)
}
