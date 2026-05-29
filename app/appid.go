package app

import (
	"crypto/sha256"
	"encoding/hex"
	"sort"
	"strings"
)

func (app *App) computeAppID() string {
	if app.cfg.AppID != "" {
		return app.cfg.AppID
	}

	var b strings.Builder

	for _, stored := range app.storedModels() {
		b.WriteString("MODEL ")
		b.WriteString(stored.Name)
		b.WriteByte('\n')
		fields := stored.Fields()
		sort.Slice(fields, func(i, j int) bool { return fields[i].Name < fields[j].Name })
		for _, f := range fields {
			b.WriteString("  FIELD ")
			b.WriteString(f.Name)
			b.WriteByte('|')
			b.WriteString(string(f.Kind))
			b.WriteByte('|')
			b.WriteString(f.RelationName)
			b.WriteByte('|')
			if f.Indexed {
				b.WriteString("idx")
			}
			b.WriteByte('|')
			if f.Unique {
				b.WriteString("uniq")
			}
			b.WriteByte('|')
			if f.Enum != nil {
				b.WriteString(f.Enum.Name)
				b.WriteByte(':')
				b.WriteString(strings.Join(f.Enum.Values, ","))
			}
			b.WriteByte('\n')
		}
	}

	names := make([]string, 0, len(app.externals))
	for n := range app.externals {
		names = append(names, n)
	}
	sort.Strings(names)
	for _, n := range names {
		ti := app.externals[n]
		b.WriteString("EXTERNAL ")
		b.WriteString(n)
		b.WriteByte('|')
		b.WriteString(ti.inputType)
		b.WriteByte('|')
		b.WriteString(ti.outputType)
		b.WriteByte('\n')
	}

	sum := sha256.Sum256([]byte(b.String()))
	return "app-" + hex.EncodeToString(sum[:])[:16]
}
