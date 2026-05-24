package field

type Field[T any] struct {
	val T
}

func (f *Field[T]) Set(v T) { f.val = v }
func (f Field[T]) Value() T { return f.val }
