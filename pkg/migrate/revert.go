package migrate

import (
	"context"
	"database/sql"
	"fmt"
	"regexp"
	"strings"
)

type RevertOptions struct {
	Steps          int
	ForceDropTable bool
}

type migrationRecord struct {
	ID        int64
	Statement string
}

var createIndexNamePattern = regexp.MustCompile(`(?i)^CREATE\s+(?:UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+("([^"]+)"|([a-zA-Z_][a-zA-Z0-9_]*))`)

func Revert(ctx context.Context, db *sql.DB, opts RevertOptions) (int, error) {
	if opts.Steps <= 0 {
		return 0, fmt.Errorf("steps must be greater than 0")
	}
	if err := ensureMigrationsTable(ctx, db); err != nil {
		return 0, err
	}

	rows, err := db.QueryContext(ctx, `
		SELECT id, statement
		FROM schema_migrations
		ORDER BY id DESC
		LIMIT $1
	`, opts.Steps)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	var records []migrationRecord
	for rows.Next() {
		var r migrationRecord
		if err := rows.Scan(&r.ID, &r.Statement); err != nil {
			return 0, err
		}
		records = append(records, r)
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}
	if len(records) == 0 {
		return 0, nil
	}

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	reverted := 0
	for _, record := range records {
		reverseStatements, err := invertMigrationStatement(record.Statement, opts.ForceDropTable)
		if err != nil {
			return reverted, fmt.Errorf("invert migration %d: %w", record.ID, err)
		}
		for _, statement := range reverseStatements {
			if _, err := tx.ExecContext(ctx, statement); err != nil {
				return reverted, fmt.Errorf("revert migration %d statement %q: %w", record.ID, truncate(statement, 80), err)
			}
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM schema_migrations WHERE id = $1`, record.ID); err != nil {
			return reverted, fmt.Errorf("delete migration %d: %w", record.ID, err)
		}
		reverted++
	}

	if err := tx.Commit(); err != nil {
		return reverted, err
	}
	return reverted, nil
}

func invertMigrationStatement(statement string, forceDropTable bool) ([]string, error) {
	parts := splitStatements(statement)
	out := make([]string, 0, len(parts))
	for i := len(parts) - 1; i >= 0; i-- {
		inverted, err := invertSingleStatement(parts[i], forceDropTable)
		if err != nil {
			return nil, err
		}
		out = append(out, inverted)
	}
	return out, nil
}

func splitStatements(statement string) []string {
	parts := strings.Split(statement, ";")
	out := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed != "" {
			out = append(out, trimmed)
		}
	}
	return out
}

func invertSingleStatement(statement string, forceDropTable bool) (string, error) {
	normalized := strings.TrimSpace(statement)
	up := strings.ToUpper(normalized)

	if strings.HasPrefix(up, "CREATE TABLE IF NOT EXISTS") {
		table := extractQuotedName(normalized)
		if table == "" {
			return "", fmt.Errorf("unsupported CREATE TABLE statement: %s", truncate(normalized, 120))
		}
		if !forceDropTable {
			return "", fmt.Errorf("reverting CREATE TABLE %q requires --force-drop-table", table)
		}
		return fmt.Sprintf(`DROP TABLE IF EXISTS "%s" CASCADE`, table), nil
	}

	if strings.HasPrefix(up, "ALTER TABLE") && strings.Contains(up, "ADD COLUMN IF NOT EXISTS") {
		table := extractQuotedName(normalized)
		column := extractSecondQuotedName(normalized)
		if table == "" || column == "" {
			return "", fmt.Errorf("unsupported ALTER TABLE statement: %s", truncate(normalized, 120))
		}
		return fmt.Sprintf(`ALTER TABLE "%s" DROP COLUMN IF EXISTS "%s"`, table, column), nil
	}

	if strings.HasPrefix(up, "CREATE") && strings.Contains(up, "INDEX IF NOT EXISTS") {
		indexName := extractIndexName(normalized)
		if indexName == "" {
			return "", fmt.Errorf("unsupported CREATE INDEX statement: %s", truncate(normalized, 120))
		}
		return fmt.Sprintf(`DROP INDEX IF EXISTS "%s"`, indexName), nil
	}

	return "", fmt.Errorf("unsupported migration statement for revert: %s", truncate(normalized, 120))
}

func extractIndexName(statement string) string {
	matches := createIndexNamePattern.FindStringSubmatch(strings.TrimSpace(statement))
	if len(matches) == 0 {
		return ""
	}
	if matches[2] != "" {
		return matches[2]
	}
	return matches[3]
}
