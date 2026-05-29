package model

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
	rv := reflect.ValueOf(body)
	if rv.Kind() == reflect.Pointer {
		rv = rv.Elem()
	}
	return validateStruct(rv)
}

func validateStruct(reflectValue reflect.Value) *FailError {
	if reflectValue.Kind() != reflect.Struct {
		return nil
	}
	rt := reflectValue.Type()
	for i := range rt.NumField() {
		structField := rt.Field(i)
		fieldValue := reflectValue.Field(i)
		if structField.Anonymous && fieldValue.Kind() == reflect.Struct {
			if err := validateStruct(fieldValue); err != nil {
				return err
			}
			continue
		}
		if fieldValue.CanInterface() {
			if v, ok := fieldValue.Interface().(fieldValidator); ok {
				if err := v.ValidateField(serde.ToSnake(structField.Name)); err != nil {
					return failFromValidation(err)
				}
			}
		}
	}
	return nil
}

func failFromValidation(err error) *FailError {
	var ve *semantic.ValidationError
	if errors.As(err, &ve) {
		return NewError("validation_error", ve.Error())
	}
	return NewError("validation_error", err.Error())
}
