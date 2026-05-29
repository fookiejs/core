package model

import "github.com/fookiejs/fookie/internal/platform"

type ID string

func NewID() ID { return ID(platform.NewUUIDv7()) }

func (id ID) String() string { return string(id) }
