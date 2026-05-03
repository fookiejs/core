package runtime

import (
	"fmt"
	"math"
	"regexp"
	"strings"
	"unicode/utf8"

	"github.com/fookiejs/fookie/pkg/ast"
	fv "github.com/fookiejs/fookie/pkg/validator"
)

// ValidationError holds all field-level validation failures for one operation.
type ValidationError struct {
	Errors []string
}

func (e *ValidationError) Error() string {
	return "validation failed: " + strings.Join(e.Errors, "; ")
}

// ValidatePayload validates a payload map against the model's field validators.
// isCreate controls whether missing required fields are also checked.
func ValidatePayload(model *ast.Model, payload map[string]interface{}, isCreate bool) error {
	var errs []string

	fieldByName := make(map[string]*ast.Field, len(model.Fields))
	for _, f := range model.Fields {
		fieldByName[f.Name] = f
	}

	// Check explicit validators on each field that appears in the payload.
	for _, f := range model.Fields {
		val, present := payload[f.Name]

		for _, v := range f.Validators {
			if v.Name == "required" {
				if isCreate && (!present || val == nil || val == "") {
					errs = append(errs, fmt.Sprintf("field '%s': required", f.Name))
				}
				continue
			}
			if !present || val == nil {
				continue
			}
			if msg := runValidator(f, v, val); msg != "" {
				errs = append(errs, fmt.Sprintf("field '%s': %s", f.Name, msg))
			}
		}

		// Semantic type validation for fields present in the payload.
		if present && val != nil && val != "" {
			if msg := validateSemanticType(f, val); msg != "" {
				errs = append(errs, fmt.Sprintf("field '%s': %s", f.Name, msg))
			}
		}
	}

	if len(errs) > 0 {
		return &ValidationError{Errors: errs}
	}
	return nil
}

func runValidator(f *ast.Field, v ast.Validator, val interface{}) string {
	switch v.Name {
	case "min":
		limit, ok := v.Arg.(float64)
		if !ok {
			return ""
		}
		switch f.Type {
		case ast.TypeString:
			s, ok := val.(string)
			if !ok {
				return ""
			}
			if utf8.RuneCountInString(s) < int(limit) {
				return fmt.Sprintf("must be at least %g characters", limit)
			}
		case ast.TypeNumber, ast.TypeCurrency:
			n, ok := validatorToFloat64(val)
			if !ok {
				return ""
			}
			if n < limit {
				return fmt.Sprintf("must be ≥ %g", limit)
			}
		}

	case "max":
		limit, ok := v.Arg.(float64)
		if !ok {
			return ""
		}
		switch f.Type {
		case ast.TypeString:
			s, ok := val.(string)
			if !ok {
				return ""
			}
			if utf8.RuneCountInString(s) > int(limit) {
				return fmt.Sprintf("must be at most %g characters", limit)
			}
		case ast.TypeNumber, ast.TypeCurrency:
			n, ok := validatorToFloat64(val)
			if !ok {
				return ""
			}
			if n > limit {
				return fmt.Sprintf("must be ≤ %g", limit)
			}
		}

	case "pattern":
		pat, ok := v.Arg.(string)
		if !ok {
			return ""
		}
		s, ok := val.(string)
		if !ok {
			return ""
		}
		re, err := regexp.Compile(pat)
		if err != nil {
			return fmt.Sprintf("invalid pattern %q: %v", pat, err)
		}
		if !re.MatchString(s) {
			return fmt.Sprintf("must match pattern %q", pat)
		}

	case "notEmpty":
		s, ok := val.(string)
		if !ok {
			return ""
		}
		if strings.TrimSpace(s) == "" {
			return "must not be empty or whitespace-only"
		}

	case "startsWith":
		prefix, ok := v.Arg.(string)
		if !ok {
			return ""
		}
		s, ok := val.(string)
		if !ok {
			return ""
		}
		if !strings.HasPrefix(s, prefix) {
			return fmt.Sprintf("must start with %q", prefix)
		}

	case "endsWith":
		suffix, ok := v.Arg.(string)
		if !ok {
			return ""
		}
		s, ok := val.(string)
		if !ok {
			return ""
		}
		if !strings.HasSuffix(s, suffix) {
			return fmt.Sprintf("must end with %q", suffix)
		}

	case "contains":
		substr, ok := v.Arg.(string)
		if !ok {
			return ""
		}
		s, ok := val.(string)
		if !ok {
			return ""
		}
		if !strings.Contains(s, substr) {
			return fmt.Sprintf("must contain %q", substr)
		}

	case "integer":
		n, ok := validatorToFloat64(val)
		if !ok {
			return ""
		}
		if n != float64(int64(n)) {
			return "must be an integer"
		}

	case "positive":
		n, ok := validatorToFloat64(val)
		if !ok {
			return ""
		}
		if n <= 0 {
			return "must be positive (> 0)"
		}

	case "multipleOf":
		factor, ok := v.Arg.(float64)
		if !ok || factor == 0 {
			return ""
		}
		n, ok := validatorToFloat64(val)
		if !ok {
			return ""
		}
		if math.Mod(n, factor) != 0 {
			return fmt.Sprintf("must be a multiple of %g", factor)
		}
	}
	return ""
}

func validateSemanticType(f *ast.Field, val interface{}) string {
	s, ok := val.(string)
	if !ok {
		return ""
	}
	check := func(fn func(...interface{}) (interface{}, error), label string) string {
		result, err := fn(s)
		if err != nil {
			return fmt.Sprintf("invalid %s", label)
		}
		if b, ok := result.(bool); ok && !b {
			return fmt.Sprintf("invalid %s", label)
		}
		return ""
	}
	switch f.Type {
	case ast.TypeEmail:
		return check(fv.IsEmail, "email address")
	case ast.TypeURL:
		return check(fv.IsURL, "URL")
	case ast.TypePhone:
		return check(fv.IsValidPhone, "phone number")
	case ast.TypeUUID:
		return check(fv.IsValidUUID, "UUID")
	case ast.TypeIBAN:
		return check(fv.IsValidIBAN, "IBAN")
	case ast.TypeIPAddress:
		if msg := check(fv.IsIPv4, "IP address"); msg != "" {
			return check(fv.IsIPv6, "IP address")
		}
	case ast.TypeColor:
		if msg := check(fv.IsHexColor, "color"); msg != "" {
			if msg2 := check(fv.IsRGBColor, "color"); msg2 != "" {
				return check(fv.IsHSLColor, "color")
			}
		}
	case ast.TypeLocale:
		return check(fv.IsValidLocale, "locale")
	}
	return ""
}

func validatorToFloat64(v interface{}) (float64, bool) {
	switch n := v.(type) {
	case float64:
		return n, true
	case float32:
		return float64(n), true
	case int:
		return float64(n), true
	case int64:
		return float64(n), true
	case int32:
		return float64(n), true
	}
	return 0, false
}
