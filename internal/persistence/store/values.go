package store

import "github.com/fookiejs/fookie/internal/persistence/row"

type Values = row.Values

func PaginateList(items []Values, limit int) ([]Values, string) {
	next := ""
	if limit > 0 && len(items) == limit {
		if idCell, ok := items[len(items)-1].Find("id"); ok && idCell.Kind == row.KindText {
			next = idCell.Text
		}
	}
	return items, next
}
