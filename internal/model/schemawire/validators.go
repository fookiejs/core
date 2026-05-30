package schemawire

import (
	"errors"
	"reflect"

	"github.com/fookiejs/fookie/internal/persistence/serde"
	"github.com/fookiejs/fookie/semantic"
)

type fieldValidator interface {
	ValidateField(field string) error
}

func ValidateBody(body any) *FailError {
	root := reflect.ValueOf(body)
	if root.Kind() == reflect.Pointer {
		root = root.Elem()
	}
	var failError *FailError
	WalkSchemaFields(root, func(structField reflect.StructField, fieldValue reflect.Value) {
		if failError != nil || !fieldValue.CanInterface() {
			return
		}
		validator, ok := fieldValue.Interface().(fieldValidator)
		if !ok {
			return
		}
		if err := validator.ValidateField(serde.ToSnake(structField.Name)); err != nil {
			failError = failFromValidation(err)
		}
	})
	return failError
}

func failFromValidation(err error) *FailError {
	var validationError *semantic.ValidationError
	if errors.As(err, &validationError) {
		return NewError("validation_error", validationError.Error())
	}
	return NewError("validation_error", err.Error())
}
