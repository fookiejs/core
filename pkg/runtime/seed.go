package runtime

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"github.com/fookiejs/fookie/pkg/ast"
	"github.com/fookiejs/fookie/pkg/compiler"
	"github.com/fookiejs/fookie/pkg/telemetry"
)

func executeSeedBlock(ctx context.Context, sb *ast.SeedBlock, exec *Executor) error {
	rc := newRunCtx(WithSystemBody(map[string]interface{}{}))
	for _, part := range sb.Parts {
		if part.Legacy != nil {
			entry := part.Legacy
			for _, record := range entry.Records {
				keyVal, ok := record[entry.KeyField]
				if !ok {
					continue
				}

				existing, err := exec.Read(ctx, entry.Model, map[string]interface{}{
					"filter": map[string]interface{}{
						compiler.SnakeCase(entry.KeyField): map[string]interface{}{"eq": keyVal},
					},
				})
				if err != nil {
					return fmt.Errorf("seed check %s.%s=%v: %w", entry.Model, entry.KeyField, keyVal, err)
				}
				if len(existing) > 0 {
					continue
				}

				if _, err := exec.Create(ctx, entry.Model, WithSystemInput(record)); err != nil {
					return fmt.Errorf("seed create %s %s=%v: %w", entry.Model, entry.KeyField, keyVal, err)
				}
			}
		}
		if len(part.Stmts) > 0 {
			if err := exec.execBlock(ctx, "seed", &ast.Block{Statements: part.Stmts}, rc); err != nil {
				return err
			}
		}
	}
	return nil
}

func ExecuteSeeds(ctx context.Context, schema *ast.Schema, exec *Executor) error {
	ctx, span := telemetry.Tracer().Start(ctx, "fookie.seed",
		trace.WithAttributes(attribute.Int("seed.blocks", len(schema.Seeds))),
	)
	defer span.End()

	for _, sb := range schema.Seeds {
		if err := executeSeedBlock(ctx, sb, exec); err != nil {
			span.SetStatus(codes.Error, err.Error())
			return err
		}
	}
	return nil
}
