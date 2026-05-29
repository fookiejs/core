package app

import (
	"crypto/sha256"
	"encoding/hex"
	"sort"
	"strings"
)

func (app *App) computeAppID() string {
	if app.config.AppID != "" {
		return app.config.AppID
	}

	var builder strings.Builder

	for _, stored := range app.storedModels() {
		builder.WriteString("MODEL ")
		builder.WriteString(stored.Name)
		builder.WriteByte('\n')
		fields := stored.Fields()
		sort.Slice(fields, func(i, j int) bool { return fields[i].Name < fields[j].Name })
		for _, field := range fields {
			builder.WriteString("  FIELD ")
			builder.WriteString(field.Name)
			builder.WriteByte('|')
			builder.WriteString(string(field.Kind))
			builder.WriteByte('|')
			builder.WriteString(field.RelationName)
			builder.WriteByte('|')
			if field.Indexed {
				builder.WriteString("idx")
			}
			builder.WriteByte('|')
			if field.Unique {
				builder.WriteString("uniq")
			}
			builder.WriteByte('|')
			if field.Enum != nil {
				builder.WriteString(field.Enum.Name)
				builder.WriteByte(':')
				builder.WriteString(strings.Join(field.Enum.Values, ","))
			}
			builder.WriteByte('\n')
		}
	}

	names := make([]string, 0, len(app.externals))
	for n := range app.externals {
		names = append(names, n)
	}
	sort.Strings(names)
	for _, n := range names {
		typeInfo := app.externals[n]
		builder.WriteString("EXTERNAL ")
		builder.WriteString(n)
		builder.WriteByte('|')
		builder.WriteString(typeInfo.inputType)
		builder.WriteByte('|')
		builder.WriteString(typeInfo.outputType)
		builder.WriteByte('\n')
	}

	sum := sha256.Sum256([]byte(builder.String()))
	return "app-" + hex.EncodeToString(sum[:])[:16]
}
