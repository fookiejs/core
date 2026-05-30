package row

import "fmt"

type Field struct {
	Column string
	Cell   Cell
}

type Values []Field

func (values Values) Find(column string) (Cell, bool) {
	for _, field := range values {
		if field.Column == column {
			return field.Cell, true
		}
	}
	return Cell{}, false
}

func (values Values) Upsert(column string, cell Cell) Values {
	for index := range values {
		if values[index].Column == column {
			values[index].Cell = cell
			return values
		}
	}
	return append(values, Field{Column: column, Cell: cell})
}

func (values Values) Remove(column string) Values {
	out := make(Values, 0, len(values))
	for _, field := range values {
		if field.Column == column {
			continue
		}
		out = append(out, field)
	}
	return out
}

func (values Values) Clone() Values {
	out := make(Values, len(values))
	copy(out, values)
	return out
}

func (values Values) TextOr(column, fallback string) string {
	cell, ok := values.Find(column)
	if !ok || cell.Kind != KindText {
		return fallback
	}
	return cell.Text
}

func (values Values) RequireText(column string) string {
	cell, ok := values.Find(column)
	if !ok || cell.Kind != KindText || cell.Text == "" {
		panic(fmt.Sprintf("row: required text column %q missing or empty", column))
	}
	return cell.Text
}
