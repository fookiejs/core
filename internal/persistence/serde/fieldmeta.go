package serde

import (
	"reflect"
	"sync"

	"github.com/fookiejs/fookie/semantic"
)

var rowFieldType = reflect.TypeOf((*semantic.RowField)(nil)).Elem()

type fieldMeta struct {
	column string
	index  []int
}

var metaCache sync.Map

func metaFor(structType reflect.Type) []fieldMeta {
	if cached, ok := metaCache.Load(structType); ok {
		return cached.([]fieldMeta)
	}
	metas := buildFieldMeta(structType, nil)
	metaCache.Store(structType, metas)
	return metas
}

func buildFieldMeta(structType reflect.Type, prefix []int) []fieldMeta {
	var metas []fieldMeta
	for fieldIndex := range structType.NumField() {
		structField := structType.Field(fieldIndex)
		index := append(append([]int{}, prefix...), fieldIndex)

		if structField.Anonymous && structField.Type.Kind() == reflect.Struct {
			if structField.Type == baseType {
				metas = append(metas, buildBaseFieldMeta(index)...)
			} else {
				metas = append(metas, buildFieldMeta(structField.Type, index)...)
			}
			continue
		}

		if reflect.PointerTo(structField.Type).Implements(rowFieldType) {
			metas = append(metas, fieldMeta{column: ToSnake(structField.Name), index: index})
		}
	}
	return metas
}

func buildBaseFieldMeta(prefix []int) []fieldMeta {
	var metas []fieldMeta
	for baseIndex := range baseType.NumField() {
		baseField := baseType.Field(baseIndex)
		if semantic.IsProtectedBaseField(baseField.Name) {
			continue
		}
		if reflect.PointerTo(baseField.Type).Implements(rowFieldType) {
			metas = append(metas, fieldMeta{column: ToSnake(baseField.Name), index: append(append([]int{}, prefix...), baseIndex)})
		}
	}
	return metas
}

func addressableStruct(structValue reflect.Value) reflect.Value {
	if structValue.CanAddr() {
		return structValue
	}
	addressable := reflect.New(structValue.Type()).Elem()
	addressable.Set(structValue)
	return addressable
}
