package reliability

import (
	"github.com/fookiejs/fookie/internal/model"
	"github.com/fookiejs/fookie/internal/persistence"
)

type App interface {
	DB() *persistence.DB
	ExternalHandlers() map[string]model.ExternalHandlerFunc
	ResumeEntity(modelName, entityID string)
	ExternalBusEnabled() bool
	PublishExternal(name, externalID string, input []byte) error
}
