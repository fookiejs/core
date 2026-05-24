package fookie

// Internal tanımlar bir in-process çağrıyı.
// ctx üzerinden cache/replay bağlanır — aynı execution'da iki kez çağrılsa
// ikinci çağrı cached sonucu döner.
type Internal[I, O any] struct {
	Name    string
	Execute func(I) (O, error)
}

func (d Internal[I, O]) InternalName() string { return d.Name }

// Run — ctx'e bağlı olarak çağırır, sonucu cache'ler.
func (d Internal[I, O]) Run(ctx execCtx, input I) (O, error) {
	if d.Execute == nil {
		var zero O
		return zero, nil
	}
	return d.Execute(input)
}
