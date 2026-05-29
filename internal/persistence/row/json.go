package row

import (
	"bytes"
	"encoding/json"
	"strconv"
)

func UnmarshalJSON(data []byte) (Map, error) {
	if len(data) == 0 {
		return Map{}, nil
	}
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.UseNumber()
	var raw map[string]json.RawMessage
	if err := dec.Decode(&raw); err != nil {
		return nil, err
	}
	out := make(Map, len(raw))
	for k, rm := range raw {
		cell, err := cellFromJSON(rm)
		if err != nil {
			return nil, err
		}
		out[k] = cell
	}
	return out, nil
}

func cellFromJSON(rm json.RawMessage) (Cell, error) {
	if string(rm) == "null" {
		return EmptyCell(), nil
	}
	var s string
	if err := json.Unmarshal(rm, &s); err == nil {
		return FromText(s), nil
	}
	var b bool
	if err := json.Unmarshal(rm, &b); err == nil {
		return FromTruth(b), nil
	}
	var n json.Number
	if err := json.Unmarshal(rm, &n); err == nil {
		if i, err := n.Int64(); err == nil {
			return FromInteger(i), nil
		}
		if f, err := n.Float64(); err == nil {
			return FromNumber(f), nil
		}
	}
	var ints []int64
	if err := json.Unmarshal(rm, &ints); err == nil {
		return FromBytes(rm), nil
	}
	var strs []string
	if err := json.Unmarshal(rm, &strs); err == nil {
		return FromBytes(rm), nil
	}
	if _, err := strconv.Unquote(string(rm)); err == nil {
		return FromBytes(rm), nil
	}
	return FromBytes(rm), nil
}
