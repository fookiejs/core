package runtime

import (
	"context"
	"fmt"

	"github.com/fookiejs/fookie/pkg/ast"
)

func ExecuteSetups(ctx context.Context, schema *ast.Schema, exec *Executor) error {
	rooms, err := exec.Read(ctx, "Room", map[string]interface{}{})
	if err != nil {
		return fmt.Errorf("setup: load rooms: %w", err)
	}
	for _, r := range rooms {
		name, _ := r["name"].(string)
		id, _ := r["id"].(string)
		if name != "" && id != "" {
			exec.RegisterRoomName(name, id)
		}
	}
	return nil
}
