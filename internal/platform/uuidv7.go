package platform

import "github.com/google/uuid"

func NewUUIDv7() string {
	id, err := uuid.NewV7()
	if err != nil {
		panic(err)
	}
	return id.String()
}
