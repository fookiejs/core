package telemetry

import (
	"strings"

	"go.opentelemetry.io/otel/attribute"
)

var bannedAttrKeys = map[string]struct{}{
	"email":          {},
	"jwt":            {},
	"random_uuid":    {},
	"raw_user_input": {},
}

func mergeAttrs(base map[string]string, extra map[string]string) map[string]string {
	if len(base) == 0 && len(extra) == 0 {
		return nil
	}
	m := make(map[string]string, len(base)+len(extra))
	for k, v := range base {
		m[k] = v
	}
	for k, v := range extra {
		m[k] = v
	}
	return m
}

func SanitizeAttrs(attrs map[string]string) map[string]string {
	return sanitizeAttrs(attrs)
}

func sanitizeAttrs(attrs map[string]string) map[string]string {
	if len(attrs) == 0 {
		return nil
	}
	out := make(map[string]string, len(attrs))
	for k, v := range attrs {
		if isForbiddenAttr(k) {
			continue
		}
		out[k] = v
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

func isForbiddenAttr(key string) bool {
	lower := strings.ToLower(strings.TrimSpace(key))
	if _, banned := bannedAttrKeys[lower]; banned {
		return true
	}
	if strings.Contains(lower, "email") {
		return true
	}
	if strings.Contains(lower, "jwt") {
		return true
	}
	return false
}

func attrsToOTel(attrs map[string]string) []attribute.KeyValue {
	if len(attrs) == 0 {
		return nil
	}
	kv := make([]attribute.KeyValue, 0, len(attrs))
	for k, v := range attrs {
		kv = append(kv, attribute.String(k, v))
	}
	return kv
}
