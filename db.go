package fookie

import (
	"context"
	"encoding/json"
	"fmt"
	"hash/fnv"
	"math"
	"strings"

	"github.com/fookiejs/fookie/semantic"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	sqlTypeText = "TEXT"
	opNear      = "@NEAR"
	opBox       = "@BOX"
)

var kindSQL = map[kind]string{
	stringKind:     sqlTypeText,
	int64Kind:      "BIGINT",
	float64Kind:    "DOUBLE PRECISION",
	boolKind:       "BOOLEAN",
	idKind:         sqlTypeText,
	currencyKind:   "BIGINT",
	emailKind:      sqlTypeText,
	jsonKind:       "JSONB",
	enumKind:       sqlTypeText,
	timestampKind:  "TIMESTAMPTZ",
	dateKind:       "DATE",
	urlKind:        sqlTypeText,
	phoneKind:      sqlTypeText,
	uuidKind:       "UUID",
	colorKind:      sqlTypeText,
	localeKind:     sqlTypeText,
	ibanKind:       sqlTypeText,
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
			sqlType = sqlTypeText
		}
		col := fmt.Sprintf(`"%s" %s`, f.ColumnName(), sqlType)
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

	// Add framework lifecycle columns (idempotent)
	ctx := context.Background()
	for _, q := range []string{
		fmt.Sprintf(`ALTER TABLE "%s" ADD COLUMN IF NOT EXISTS "_fookie_status" TEXT NOT NULL DEFAULT 'active'`, model.name),
		fmt.Sprintf(`ALTER TABLE "%s" ADD COLUMN IF NOT EXISTS "_fookie_error" TEXT`, model.name),
	} {
		if _, err := d.pool.Exec(ctx, q); err != nil {
			return fmt.Errorf("alter table %s: %w", model.name, err)
		}
	}

	for _, f := range model.fields {
		if f.Name == "id" {
			continue
		}
		sqlType, ok := kindSQL[f.Kind]
		if !ok {
			sqlType = sqlTypeText
		}
		_, _ = d.pool.Exec(context.Background(),
			fmt.Sprintf(`ALTER TABLE "%s" ADD COLUMN IF NOT EXISTS "%s" %s`,
				model.name, f.ColumnName(), sqlType))
	}

	for _, f := range model.fields {
		if !f.Indexed {
			continue
		}
		idx := fmt.Sprintf(`CREATE INDEX IF NOT EXISTS "%s_%s_idx" ON "%s" ("%s")`,
			model.name, f.ColumnName(), model.name, f.ColumnName())
		if _, err := d.pool.Exec(context.Background(), idx); err != nil {
			return fmt.Errorf("index %s.%s: %w", model.name, f.Name, err)
		}
	}
	for _, f := range model.fields {
		if !f.Unique || f.Name == "id" {
			continue
		}
		idx := fmt.Sprintf(`CREATE UNIQUE INDEX IF NOT EXISTS "%s_%s_unique_idx" ON "%s" ("%s")`,
			model.name, f.ColumnName(), model.name, f.ColumnName())
		if _, err := d.pool.Exec(context.Background(), idx); err != nil {
			return fmt.Errorf("unique index %s.%s: %w", model.name, f.Name, err)
		}
	}
	return nil
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
	return normalizeRow(model, results[0]), nil
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
		sets = append(sets, fmt.Sprintf(`"%s" = $%d`, f.ColumnName(), n))
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
	return normalizeRow(model, results[0]), nil
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
	return normalizeRow(model, results[0]), nil
}

func sumTx(tx pgx.Tx, model *storedModel, column, excludeID string, filters []queryFilter) (int64, error) {
	var where []string
	var args []any
	n := 1

	for _, f := range filters {
		ff := queryFilter{
			field: model.columnForField(f.field),
			op:    f.op,
			value: f.value,
		}
		clause, fa, err := buildFilterClause(ff, n)
		if err != nil {
			return 0, err
		}
		where = append(where, clause)
		args = append(args, fa...)
		n += len(fa)
	}
	if excludeID != "" {
		where = append(where, fmt.Sprintf(`"id" != $%d`, n))
		args = append(args, excludeID)
		n++
	}
	where = append(where, `"_fookie_status" = 'active'`)

	q := fmt.Sprintf(`SELECT COALESCE(SUM("%s"), 0) FROM "%s"`, column, model.name)
	if len(where) > 0 {
		q += " WHERE " + strings.Join(where, " AND ")
	}

	var total int64
	err := tx.QueryRow(context.Background(), q, args...).Scan(&total)
	return total, err
}

func buildFilterClause(f queryFilter, n int) (string, []any, error) {
	switch f.op {
	case "IN":
		return fmt.Sprintf(`"%s" = ANY($%d)`, f.field, n), []any{f.value}, nil
	case opNear:
		cf, ok := f.value.(semantic.CoordinateFilter)
		if !ok {
			return "", nil, fmt.Errorf("buildFilterClause: @NEAR filter on field %q expects CoordinateFilter, got %T", f.field, f.value)
		}
		dLat := cf.Radius / 111111.0
		dLon := cf.Radius / (111111.0 * math.Cos(cf.Lat*math.Pi/180.0))
		clause := fmt.Sprintf(`"%s" <@ box(point($%d,$%d),point($%d,$%d))`,
			f.field, n, n+1, n+2, n+3)
		return clause, []any{cf.Lat - dLat, cf.Lon - dLon, cf.Lat + dLat, cf.Lon + dLon}, nil
	case opBox:
		bf, ok := f.value.(semantic.BoxFilter)
		if !ok {
			return "", nil, fmt.Errorf("buildFilterClause: @BOX filter on field %q expects BoxFilter, got %T", f.field, f.value)
		}
		clause := fmt.Sprintf(`"%s" <@ box(point($%d,$%d),point($%d,$%d))`,
			f.field, n, n+1, n+2, n+3)
		return clause, []any{bf.MinLat, bf.MinLon, bf.MaxLat, bf.MaxLon}, nil
	default:
		return fmt.Sprintf(`"%s" %s $%d`, f.field, f.op, n), []any{f.value}, nil
	}
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
		ff := queryFilter{
			field: model.columnForField(f.field),
			op:    f.op,
			value: f.value,
		}
		clause, fa, err := buildFilterClause(ff, n)
		if err != nil {
			return nil, err
		}
		where = append(where, clause)
		args = append(args, fa...)
		n += len(fa)
	}
	switch qb.cursorDir {
	case cursorAfter:
		where = append(where, fmt.Sprintf(`"id" > $%d`, n))
		args = append(args, qb.cursor)
	case cursorBefore:
		where = append(where, fmt.Sprintf(`"id" < $%d`, n))
		args = append(args, qb.cursor)
	default:
		// cursorNone — no cursor filter
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
	out, err := collectRows(rows)
	if err != nil {
		return nil, err
	}
	return normalizeRows(model, out), nil
}

func findExistingByUniqueFields(ctx context.Context, q querier, model *storedModel, row map[string]any) (map[string]any, error) {
	var where []string
	var args []any
	n := 1
	for _, f := range model.fields {
		if !f.Unique || f.Name == "id" {
			continue
		}
		v, ok := row[f.Name]
		if !ok || v == nil {
			continue
		}
		if s, ok := v.(string); ok && s == "" {
			continue
		}
		where = append(where, fmt.Sprintf(`"%s" = $%d`, f.ColumnName(), n))
		args = append(args, encodeVal(f.Kind, v))
		n++
	}
	if len(where) == 0 {
		return nil, nil
	}
	qry := fmt.Sprintf(`SELECT * FROM "%s" WHERE %s LIMIT 1`, model.name, strings.Join(where, " AND "))
	rows, err := q.Query(ctx, qry, args...)
	if err != nil {
		return nil, fmt.Errorf("find unique %s: %w", model.name, err)
	}
	results, err := collectRows(rows)
	if err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, nil
	}
	return normalizeRow(model, results[0]), nil
}

type querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

func (d *db) resetEntityPending(ctx context.Context, model *storedModel, entityID string) error {
	_, err := d.pool.Exec(ctx,
		fmt.Sprintf(`UPDATE "%s" SET "_fookie_status"='pending', "_fookie_error"=NULL WHERE "id"=$1`, model.name),
		entityID)
	return err
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
	return normalizeRow(model, results[0]), nil
}

func buildInsertParts(model *storedModel, row map[string]any) (cols []string, args []any, placeholders []string) {
	seen := map[string]bool{}
	i := 1
	for _, f := range model.fields {
		if seen[f.Name] {
			continue
		}
		v, ok := row[f.Name]
		if !ok {
			continue
		}
		seen[f.Name] = true
		cols = append(cols, fmt.Sprintf(`"%s"`, f.ColumnName()))
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
			row[d.Name] = vals[i]
		}
		out = append(out, row)
	}
	return out, rows.Err()
}
