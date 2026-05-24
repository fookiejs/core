package fookie

type Internal[I, O any] struct {
	Name    string
	Execute func(I) (O, error)
}

func (d Internal[I, O]) InternalName() string { return d.Name }

func (d Internal[I, O]) Run(ctx execCtx, input I) (O, error) {
	if d.Execute == nil {
		var zero O
		return zero, nil
	}
	return d.Execute(input)
}
