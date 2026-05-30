package reliability

import (
	"github.com/fookiejs/fookie/internal/model/flowext"
	"github.com/fookiejs/fookie/internal/persistence"
)

type App interface {
	DB() *persistence.DB
	ExternalHandlers() map[string]flowext.ExternalHandlerFunc
	ResumeEntity(modelName, entityID string)
	ExternalBusEnabled() bool
	PublishExternal(name, externalID string, input []byte) error
}
