package semantic

type RowField interface {
	TypedField
	SetKey(string)
	SetFilter(FilterFn)
	RowValue() any
	RowSet(any) bool
}
