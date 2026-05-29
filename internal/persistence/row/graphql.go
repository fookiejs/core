package row

import "github.com/fookiejs/fookie/semantic"

func FilterValueFromGraphQL(v any) semantic.FilterValue {
	return FromDriver(v).FilterValue()
}

func (c Cell) FilterValue() semantic.FilterValue {
	switch c.Kind {
	case KindText:
		return semantic.FilterText(c.Text)
	case KindInteger:
		return semantic.FilterInteger(c.Integer)
	case KindNumber:
		return semantic.FilterNumber(c.Number)
	case KindTruth:
		return semantic.FilterTruth(c.Truth)
	default:
		return semantic.FilterText(c.String())
	}
}

func (c Cell) GraphQLScalar() any {
	if c.Kind == KindEmpty {
		return nil
	}
	return c.DriverValue(false)
}
