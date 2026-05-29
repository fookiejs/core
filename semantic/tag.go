package semantic

import (
	"strconv"
	"strings"
)

type SchemaFlags struct {
	Indexed  bool
	Unique   bool
	Relation string
}

func ApplySchemaTag(part string, schema *SchemaFlags) bool {
	switch {
	case part == "indexed":
		schema.Indexed = true
		return true
	case part == "unique":
		schema.Unique = true
		return true
	case strings.HasPrefix(part, "relation:"):
		schema.Relation = strings.TrimPrefix(part, "relation:")
		return true
	default:
		return false
	}
}

func ParseMinTag(part string) (int64, bool) {
	if !strings.HasPrefix(part, "min=") {
		return 0, false
	}
	v, err := strconv.ParseInt(strings.TrimPrefix(part, "min="), 10, 64)
	return v, err == nil
}

func ParseMaxTag(part string) (int64, bool) {
	if !strings.HasPrefix(part, "max=") {
		return 0, false
	}
	v, err := strconv.ParseInt(strings.TrimPrefix(part, "max="), 10, 64)
	return v, err == nil
}

func ParseMinFloatTag(part string) (float64, bool) {
	v, ok := ParseMinTag(part)
	return float64(v), ok
}

func ParseMaxFloatTag(part string) (float64, bool) {
	v, ok := ParseMaxTag(part)
	return float64(v), ok
}
