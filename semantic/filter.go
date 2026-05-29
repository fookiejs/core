package semantic

type FilterValue interface {
	filterValue()
}

type FilterText string

func (FilterText) filterValue() {}

type FilterTexts []string

func (FilterTexts) filterValue() {}

type FilterInteger int64

func (FilterInteger) filterValue() {}

type FilterIntegers []int64

func (FilterIntegers) filterValue() {}

type FilterNumber float64

func (FilterNumber) filterValue() {}

type FilterTruth bool

func (FilterTruth) filterValue() {}

func (CoordinateFilter) filterValue() {}

func (BoxFilter) filterValue() {}

type FilterFn func(op string, val FilterValue)
