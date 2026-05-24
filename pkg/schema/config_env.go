package schema

import (
	"os"
	"strconv"
	"strings"

	"github.com/fookiejs/fookie/pkg/ast"
)

func applyConfigEnv(s *ast.Schema) {
	if s == nil {
		return
	}
	for _, c := range s.Configs {
		if c == nil {
			continue
		}
		raw := os.Getenv(configEnvKey(c.Key))
		if raw == "" {
			continue
		}
		v, err := parseConfigEnvValue(c.Type, raw)
		if err != nil {
			continue
		}
		c.Value = v
	}
}

func configEnvKey(key string) string {
	return "FOOKIE_CONFIG_" + strings.ToUpper(key)
}

func parseConfigEnvValue(t ast.FieldType, raw string) (interface{}, error) {
	switch t {
	case ast.TypeBoolean:
		v, err := strconv.ParseBool(raw)
		if err != nil {
			return nil, err
		}
		return v, nil
	case ast.TypeNumber, ast.TypeCurrency:
		v, err := strconv.ParseFloat(raw, 64)
		if err != nil {
			return nil, err
		}
		return v, nil
	default:
		return raw, nil
	}
}
