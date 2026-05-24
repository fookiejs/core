package fookie

import (
	"context"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var kindSQL = map[kind]string{
	stringKind:     "TEXT",
	int64Kind:      "BIGINT",
	float64Kind:    "DOUBLE PRECISION",
	boolKind:       "BOOLEAN",
	idKind:         "TEXT",
	currencyKind:   "BIGINT",
	emailKind:      "TEXT",
	jsonKind:       "JSONB",
	enumKind:       "TEXT",
	timestampKind:  "TIMESTAMPTZ",
	dateKind:       "DATE",
	urlKind:        "TEXT",
	phoneKind:      "TEXT",
	uuidKind:       "UUID",
	colorKind:      "TEXT",
	localeKind:     "TEXT",
	ibanKind:       "TEXT",
	ipKind:         "INET",
	coordinateKind: "POINT",
}

type db struct {
	pool *pgxpool.Pool
}

func openDB(connStr string) (*db, error) {
	pool, err := pgxpool.New(context.Background(), connStr)
	if err != nil {
		return nil, fmt.Errorf("pgxpool.New: %w", err)
	}
	if err := pool.Ping(context.Background()); err != nil {
		return nil, fmt.Errorf("db ping: %w", err)
	}
	return &db{pool: pool}, nil
}

func (d *db) begin(ctx context.Context) (pgx.Tx, error) {
	return d.pool.Begin(ctx)
}

func (d *db) migrate(models []*storedModel) error {
	for _, m := range models {
		if err := d.migrateModel(m); err != nil {
			return fmt.Errorf("migrate %s: %w", m.name, err)
		}
	}
	return nil
}

func (d *db) migrateModel(model *storedModel) error {
	cols := []string{`"id" TEXT PRIMARY KEY`}
	for _, f := range model.fields {
		if f.Name == "id" {
			continue
		}
		sqlType, ok := kindSQL[f.Kind]
		if !ok {
			sqlType = "TEXT"
		}
		col := fmt.Sprintf(`"%s" %s`, f.Name, sqlType)
		if f.Unique {
			col += " UNIQUE"
		}
		cols = append(cols, col)
	}
	query := fmt.Sprintf(`CREATE TABLE IF NOT EXISTS "%s" (%s)`,
		model.name, strings.Join(cols, ", "))
	if _, err := d.pool.Exec(context.Background(), query); err != nil {
		return err
	}

	for _, f := range model.fields {
		if !f.Indexed {
			continue
		}
		idx := fmt.Sprintf(`CREATE INDEX IF NOT EXISTS "%s_%s_idx" ON "%s" ("%s")`,
			model.name, f.Name, model.name, f.Name)
		if _, err := d.pool.Exec(context.Background(), idx); err != nil {
			return fmt.Errorf("index %s.%s: %w", model.name, f.Name, err)
		}
	}
	return nil
}

func (d *db) insert(model *storedModel, row map[string]any) (map[string]any, error) {
	tx, err := d.pool.Begin(context.Background())
	if err != nil {
		return nil, err
	}
	result, err := insertTx(tx, model, row)
	if err != nil {
		_ = tx.Rollback(context.Background())
		return nil, err
	}
	return result, tx.Commit(context.Background())
}

func insertTx(tx pgx.Tx, model *storedModel, row map[string]any) (map[string]any, error) {
	cols, args, placeholders := buildInsertParts(model, row)
	if len(cols) == 0 {
		return nil, fmt.Errorf("insert %s: empty row", model.name)
	}
	q := fmt.Sprintf(`INSERT INTO "%s" (%s) VALUES (%s) RETURNING *`,
		model.name,
		strings.Join(cols, ", "),
		strings.Join(placeholders, ", "),
	)
	rows, err := tx.Query(context.Background(), q, args...)
	if err != nil {
		return nil, fmt.Errorf("insert %s: %w", model.name, err)
	}
	results, err := collectRows(rows)
	if err != nil || len(results) == 0 {
		return nil, err
	}
	return results[0], nil
}

func updateTx(tx pgx.Tx, model *storedModel, id string, row map[string]any) (map[string]any, error) {
	if len(row) == 0 {
		return readTx(tx, model, id)
	}
	var sets []string
	var args []any
	n := 1

	for _, f := range model.fields {
		if f.Name == "id" {
			continue
		}
		v, ok := row[f.Name]
		if !ok {
			continue
		}
		sets = append(sets, fmt.Sprintf(`"%s" = $%d`, f.Name, n))
		args = append(args, encodeVal(f.Kind, v))
		n++
	}
	if len(sets) == 0 {
		return readTx(tx, model, id)
	}
	args = append(args, id)
	q := fmt.Sprintf(`UPDATE "%s" SET %s WHERE "id" = $%d RETURNING *`,
		model.name, strings.Join(sets, ", "), n)
	rows, err := tx.Query(context.Background(), q, args...)
	if err != nil {
		return nil, fmt.Errorf("update %s: %w", model.name, err)
	}
	results, err := collectRows(rows)
	if err != nil || len(results) == 0 {
		return nil, err
	}
	return results[0], nil
}

func readTx(tx pgx.Tx, model *storedModel, id string) (map[string]any, error) {
	q := fmt.Sprintf(`SELECT * FROM "%s" WHERE "id" = $1 LIMIT 1`, model.name)
	rows, err := tx.Query(context.Background(), q, id)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", model.name, err)
	}
	results, err := collectRows(rows)
	if err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("not_found")
	}
	return results[0], nil
}

func sumTx(tx pgx.Tx, model *storedModel, column, excludeID string, filters []queryFilter) (int64, error) {
	var where []string
	var args []any
	n := 1

	for _, f := range filters {
		where = append(where, fmt.Sprintf(`"%s" %s $%d`, f.field, f.op, n))
		args = append(args, f.value)
		n++
	}
	if excludeID != "" {
		where = append(where, fmt.Sprintf(`"id" != $%d`, n))
		args = append(args, excludeID)
	}

	q := fmt.Sprintf(`SELECT COALESCE(SUM("%s"), 0) FROM "%s"`, column, model.name)
	if len(where) > 0 {
		q += " WHERE " + strings.Join(where, " AND ")
	}

	var total int64
	err := tx.QueryRow(context.Background(), q, args...).Scan(&total)
	return total, err
}

func dbAdvisoryLock(tx pgx.Tx, key string) error {
	h := fnv.New64a()
	_, _ = h.Write([]byte(key))
	lockKey := int64(h.Sum64()) //nolint:gosec
	_, err := tx.Exec(context.Background(), "SELECT pg_advisory_xact_lock($1)", lockKey)
	return err
}

func (d *db) list(model *storedModel, qb *queryBuilder) ([]map[string]any, error) {
	var where []string
	var args []any
	n := 1

	for _, f := range qb.filters {
		where = append(where, fmt.Sprintf(`"%s" %s $%d`, f.field, f.op, n))
		args = append(args, f.value)
		n++
	}
	switch qb.cursorDir {
	case cursorAfter:
		where = append(where, fmt.Sprintf(`"id" > $%d`, n))
		args = append(args, qb.cursor)
		n++
	case cursorBefore:
		where = append(where, fmt.Sprintf(`"id" < $%d`, n))
		args = append(args, qb.cursor)
		n++
	}

	q := fmt.Sprintf(`SELECT * FROM "%s"`, model.name)
	if len(where) > 0 {
		q += " WHERE " + strings.Join(where, " AND ")
	}
	if len(qb.orders) > 0 {
		parts := make([]string, 0, len(qb.orders))
		for _, o := range qb.orders {
			dir := "ASC"
			if o.desc {
				dir = "DESC"
			}
			parts = append(parts, fmt.Sprintf(`"%s" %s`, o.field, dir))
		}
		q += " ORDER BY " + strings.Join(parts, ", ")
	}
	limit := qb.limit
	if limit <= 0 {
		limit = 50
	}
	q += fmt.Sprintf(" LIMIT %d", limit)

	rows, err := d.pool.Query(context.Background(), q, args...)
	if err != nil {
		return nil, fmt.Errorf("list %s: %w", model.name, err)
	}
	return collectRows(rows)
}

func (d *db) read(model *storedModel, id string) (map[string]any, error) {
	q := fmt.Sprintf(`SELECT * FROM "%s" WHERE "id" = $1 LIMIT 1`, model.name)
	rows, err := d.pool.Query(context.Background(), q, id)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", model.name, err)
	}
	results, err := collectRows(rows)
	if err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("not_found")
	}
	return results[0], nil
}

func (d *db) update(model *storedModel, id string, row map[string]any) (map[string]any, error) {
	tx, err := d.pool.Begin(context.Background())
	if err != nil {
		return nil, err
	}
	result, err := updateTx(tx, model, id, row)
	if err != nil {
		_ = tx.Rollback(context.Background())
		return nil, err
	}
	return result, tx.Commit(context.Background())
}

func (d *db) delete(model *storedModel, id string) error {
	q := fmt.Sprintf(`DELETE FROM "%s" WHERE "id" = $1`, model.name)
	_, err := d.pool.Exec(context.Background(), q, id)
	if err != nil {
		return fmt.Errorf("delete %s: %w", model.name, err)
	}
	return nil
}

func buildInsertParts(model *storedModel, row map[string]any) (cols []string, args []any, placeholders []string) {
	allFields := append([]FieldDef{{Name: "id", Kind: idKind}}, model.fields...)
	seen := map[string]bool{}
	i := 1
	for _, f := range allFields {
		if seen[f.Name] {
			continue
		}
		v, ok := row[f.Name]
		if !ok {
			continue
		}
		seen[f.Name] = true
		cols = append(cols, fmt.Sprintf(`"%s"`, f.Name))
		args = append(args, encodeVal(f.Kind, v))
		placeholders = append(placeholders, fmt.Sprintf("$%d", i))
		i++
	}
	return cols, args, placeholders
}

func encodeVal(k kind, v any) any {
	if k == jsonKind && v != nil {
		b, _ := json.Marshal(v)
		return string(b)
	}
	return v
}

func collectRows(rows pgx.Rows) ([]map[string]any, error) {
	defer rows.Close()
	descs := rows.FieldDescriptions()
	var out []map[string]any
	for rows.Next() {
		vals, err := rows.Values()
		if err != nil {
			return nil, err
		}
		row := make(map[string]any, len(descs))
		for i, d := range descs {
			row[string(d.Name)] = vals[i]
		}
		out = append(out, row)
	}
	return out, rows.Err()
}
