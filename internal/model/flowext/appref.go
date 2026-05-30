package flowext

import (
	"github.com/fookiejs/fookie/internal/persistence"
)

type AppRef interface {
	DB() *persistence.DB
	CompensationLinks() map[string]string
	ListLimit() int
}
