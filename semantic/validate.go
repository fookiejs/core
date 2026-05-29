package semantic

type ValidationError struct {
	Field string
	Rule  string
}

func (e *ValidationError) Error() string {
	return e.Field + " " + e.Rule
}

type intValidator func(field string, v int64) error

func intMin(min int64) intValidator {
	return func(field string, v int64) error {
		if v < min {
			return &ValidationError{Field: field, Rule: "below minimum"}
		}
		return nil
	}
}

func intMax(max int64) intValidator {
	return func(field string, v int64) error {
		if v > max {
			return &ValidationError{Field: field, Rule: "exceeds maximum"}
		}
		return nil
	}
}

type floatValidator func(field string, v float64) error

func floatMin(min float64) floatValidator {
	return func(field string, v float64) error {
		if v < min {
			return &ValidationError{Field: field, Rule: "below minimum"}
		}
		return nil
	}
}

func floatMax(max float64) floatValidator {
	return func(field string, v float64) error {
		if v > max {
			return &ValidationError{Field: field, Rule: "exceeds maximum"}
		}
		return nil
	}
}
