package store

import (
	"context"
	"fmt"
	"hash/fnv"
	"math"
	"regexp"
	"strings"

	"github.com/fookiejs/fookie/internal/persistence/row"
	"github.com/fookiejs/fookie/semantic"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	CursorNone = iota
	CursorAfter
	CursorBefore
)

const (
	opIn   = "IN"
	opNear = "@NEAR"
	opBox  = "@BOX"
)

const activeOnly = `"is_deleted" = false`

type Column struct {
	Field   string
	Name    string
	SQLType string
	Unique  bool
	Indexed bool
	IsJSON  bool
	IsID    bool
}

type Table struct {
	Name    string
	Columns []Column
}

type Filter struct {
	Field string
	Op    string
	Value semantic.FilterValue
}

type Order struct {
	Field string
	Desc  bool
}

type Query struct {
	Filters   []Filter
	Orders    []Order
	Limit     int
	Cursor    string
	CursorDir int
}

type Querier interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

type DB struct {
	Pool *pgxpool.Pool
}

func Open(connStr string) (*DB, error) {
	pool, err := pgxpool.New(context.Background(), connStr)
	if err != nil {
		return nil, fmt.Errorf("pgxpool.New: %w", err)
	}
	if err := pool.Ping(context.Background()); err != nil {
		return nil, fmt.Errorf("database ping: %w", err)
	}
	return &DB{Pool: pool}, nil
}

func (d *DB) Begin(ctx context.Context) (pgx.Tx, error) {
	return d.Pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
}

func SavepointTx(ctx context.Context, transaction pgx.Tx, name string) error {
	if !validSavepointName(name) {
		return fmt.Errorf("invalid savepoint name")
	}
	_, err := transaction.Exec(ctx, fmt.Sprintf("SAVEPOINT %s", name))
	return err
}

func RollbackToSavepointTx(ctx context.Context, transaction pgx.Tx, name string) error {
	if !validSavepointName(name) {
		return fmt.Errorf("invalid savepoint name")
	}
	_, err := transaction.Exec(ctx, fmt.Sprintf("ROLLBACK TO SAVEPOINT %s", name))
	return err
}

func ReleaseSavepointTx(ctx context.Context, transaction pgx.Tx, name string) error {
	if !validSavepointName(name) {
		return fmt.Errorf("invalid savepoint name")
	}
	_, err := transaction.Exec(ctx, fmt.Sprintf("RELEASE SAVEPOINT %s", name))
	return err
}

var savepointNamePattern = regexp.MustCompile(`^[a-zA-Z0-9_]{1,64}$`)

func validSavepointName(name string) bool {
	return savepointNamePattern.MatchString(name)
}

func (d *DB) Migrate(tables []Table) error {
	for _, t := range tables {
		if err := d.migrateTable(t); err != nil {
			return fmt.Errorf("migrate %s: %w", t.Name, err)
		}
	}
	return nil
}

func (d *DB) migrateTable(table Table) error {
	cols := []string{`"id" TEXT PRIMARY KEY`}
	for _, c := range table.Columns {
		if c.IsID {
			continue
		}
		col := fmt.Sprintf(`"%s" %s`, c.Name, c.SQLType)
		cols = append(cols, col)
	}
	query := fmt.Sprintf(`CREATE TABLE IF NOT EXISTS "%s" (%s)`, table.Name, strings.Join(cols, ", "))
	if _, err := d.Pool.Exec(context.Background(), query); err != nil {
		return err
	}

	ctx := context.Background()
	for _, query := range []string{
		fmt.Sprintf(`ALTER TABLE "%s" ADD COLUMN IF NOT EXISTS "_fookie_status" TEXT NOT NULL DEFAULT 'active'`, table.Name),
		fmt.Sprintf(`ALTER TABLE "%s" ADD COLUMN IF NOT EXISTS "_fookie_error" TEXT`, table.Name),
		fmt.Sprintf(`ALTER TABLE "%s" ADD COLUMN IF NOT EXISTS "_fookie_headers" TEXT`, table.Name),
		fmt.Sprintf(`ALTER TABLE "%s" ADD COLUMN IF NOT EXISTS "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()`, table.Name),
		fmt.Sprintf(`ALTER TABLE "%s" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()`, table.Name),
		fmt.Sprintf(`ALTER TABLE "%s" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN NOT NULL DEFAULT false`, table.Name),
	} {
		if _, err := d.Pool.Exec(ctx, query); err != nil {
			return fmt.Errorf("alter table %s: %w", table.Name, err)
		}
	}

	for _, c := range table.Columns {
		if c.IsID {
			continue
		}
		if _, err := d.Pool.Exec(context.Background(),
			fmt.Sprintf(`ALTER TABLE "%s" ADD COLUMN IF NOT EXISTS "%s" %s`, table.Name, c.Name, c.SQLType)); err != nil {
			return fmt.Errorf("add column %s.%s: %w", table.Name, c.Name, err)
		}
	}

	for _, column := range table.Columns {
		if !column.Indexed {
			continue
		}
		idx := fmt.Sprintf(`CREATE INDEX IF NOT EXISTS "%s_%s_idx" ON "%s" ("%s")`, table.Name, column.Name, table.Name, column.Name)
		if _, err := d.Pool.Exec(context.Background(), idx); err != nil {
			return fmt.Errorf("index %s.%s: %w", table.Name, column.Field, err)
		}
	}
	for _, column := range table.Columns {
		if !column.Unique || column.IsID {
			continue
		}
		idx := fmt.Sprintf(`CREATE UNIQUE INDEX IF NOT EXISTS "%s_%s_unique_idx" ON "%s" ("%s") WHERE %s`, table.Name, column.Name, table.Name, column.Name, activeOnly)
		if _, err := d.Pool.Exec(context.Background(), idx); err != nil {
			return fmt.Errorf("unique index %s.%s: %w", table.Name, column.Field, err)
		}
	}
	return nil
}

func InsertTx(transaction pgx.Tx, table Table, data row.Map) (row.Map, error) {
	cols, args, placeholders := buildInsertParts(table, data)
	if len(cols) == 0 {
		return nil, fmt.Errorf("insert %s: empty row", table.Name)
	}
	q := fmt.Sprintf(`INSERT INTO "%s" (%s) VALUES (%s) RETURNING *`,
		table.Name, strings.Join(cols, ", "), strings.Join(placeholders, ", "))
	rows, err := transaction.Query(context.Background(), q, args...)
	if err != nil {
		return nil, fmt.Errorf("insert %s: %w", table.Name, err)
	}
	results, err := collectRows(rows)
	if err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("insert %s: no rows returned", table.Name)
	}
	return normalizeRow(table, results[0]), nil
}

func UpdateTx(transaction pgx.Tx, t Table, identifier string, data row.Map) (row.Map, error) {
	if len(data) == 0 {
		return ReadTx(transaction, t, identifier)
	}
	var sets []string
	var args []any
	n := 1
	for _, column := range t.Columns {
		if column.IsID {
			continue
		}
		v, ok := data[column.Field]
		if !ok {
			continue
		}
		sets = append(sets, fmt.Sprintf(`"%s" = $%d`, column.Name, n))
		args = append(args, encodeVal(column, v))
		n++
	}
	if len(sets) == 0 {
		return ReadTx(transaction, t, identifier)
	}
	args = append(args, identifier)
	q := fmt.Sprintf(`UPDATE "%s" SET %s WHERE "id" = $%d RETURNING *`,
		t.Name, strings.Join(sets, ", "), n)
	rows, err := transaction.Query(context.Background(), q, args...)
	if err != nil {
		return nil, fmt.Errorf("update %s: %w", t.Name, err)
	}
	results, err := collectRows(rows)
	if err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("not_found")
	}
	return normalizeRow(t, results[0]), nil
}

func DeleteTx(transaction pgx.Tx, t Table, id, updatedAt string) error {
	tag, err := transaction.Exec(context.Background(),
		fmt.Sprintf(`UPDATE "%s" SET "is_deleted" = true, "updated_at" = $1 WHERE "id" = $2 AND %s`, t.Name, activeOnly),
		updatedAt, id)
	if err != nil {
		return fmt.Errorf("delete %s: %w", t.Name, err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("not_found")
	}
	return nil
}

func ReadTx(transaction pgx.Tx, t Table, id string) (row.Map, error) {
	q := fmt.Sprintf(`SELECT * FROM "%s" WHERE "id" = $1 AND %s LIMIT 1`, t.Name, activeOnly)
	rows, err := transaction.Query(context.Background(), q, id)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", t.Name, err)
	}
	results, err := collectRows(rows)
	if err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("not_found")
	}
	return normalizeRow(t, results[0]), nil
}

func SumTx(transaction pgx.Tx, t Table, column, excludeID string, filters []Filter) (int64, error) {
	var where []string
	var args []any
	n := 1
	for _, f := range filters {
		filterArguments, clauseArguments, err := buildFilterClause(f, n)
		if err != nil {
			return 0, err
		}
		where = append(where, filterArguments)
		args = append(args, clauseArguments...)
		n += len(clauseArguments)
	}
	if excludeID != "" {
		where = append(where, fmt.Sprintf(`"id" != $%d`, n))
		args = append(args, excludeID)
	}
	where = append(where, activeOnly)
	where = append(where, `"_fookie_status" = 'active'`)

	query := fmt.Sprintf(`SELECT COALESCE(SUM("%s"), 0) FROM "%s"`, column, t.Name)
	if len(where) > 0 {
		query += " WHERE " + strings.Join(where, " AND ")
	}

	var total int64
	err := transaction.QueryRow(context.Background(), query, args...).Scan(&total)
	return total, err
}

func (d *DB) List(t Table, q Query) ([]row.Map, error) {
	return ListQuerier(context.Background(), d.Pool, t, q)
}

func ListTx(ctx context.Context, transaction pgx.Tx, t Table, q Query) ([]row.Map, error) {
	return ListQuerier(ctx, transaction, t, q)
}

func ListQuerier(ctx context.Context, q Querier, table Table, query Query) ([]row.Map, error) {
	qry, args, err := buildListSQL(table, query)
	if err != nil {
		return nil, err
	}
	rows, err := q.Query(ctx, qry, args...)
	if err != nil {
		return nil, fmt.Errorf("list %s: %w", table.Name, err)
	}
	out, err := collectRows(rows)
	if err != nil {
		return nil, err
	}
	return normalizeRows(table, out), nil
}

func buildListSQL(t Table, q Query) (string, []any, error) {
	var where []string
	var args []any
	n := 1
	where = append(where, activeOnly)
	for _, f := range q.Filters {
		filterArguments, clauseArguments, err := buildFilterClause(f, n)
		if err != nil {
			return "", nil, err
		}
		where = append(where, filterArguments)
		args = append(args, clauseArguments...)
		n += len(clauseArguments)
	}
	switch q.CursorDir {
	case CursorAfter:
		where = append(where, fmt.Sprintf(`"id" > $%d`, n))
		args = append(args, q.Cursor)
	case CursorBefore:
		where = append(where, fmt.Sprintf(`"id" < $%d`, n))
		args = append(args, q.Cursor)
	}
	qry := fmt.Sprintf(`SELECT * FROM "%s"`, t.Name)
	if len(where) > 0 {
		qry += " WHERE " + strings.Join(where, " AND ")
	}
	if len(q.Orders) > 0 {
		parts := make([]string, 0, len(q.Orders))
		for _, o := range q.Orders {
			dir := "ASC"
			if o.Desc {
				dir = "DESC"
			}
			parts = append(parts, fmt.Sprintf(`"%s" %s`, o.Field, dir))
		}
		qry += " ORDER BY " + strings.Join(parts, ", ")
	}
	limit := q.Limit
	if limit <= 0 {
		limit = 50
	}
	qry += fmt.Sprintf(" LIMIT %d", limit)
	return qry, args, nil
}

func FindExistingByUnique(ctx context.Context, querier Querier, table Table, data row.Map) (row.Map, error) {
	var where []string
	var args []any
	n := 1
	for _, column := range table.Columns {
		if !column.Unique || column.IsID {
			continue
		}
		value, ok := data[column.Field]
		if !ok || value.Kind == row.KindEmpty {
			continue
		}
		if value.Kind == row.KindText && value.Text == "" {
			continue
		}
		where = append(where, fmt.Sprintf(`"%s" = $%d`, column.Name, n))
		args = append(args, encodeVal(column, value))
		n++
	}
	if len(where) == 0 {
		return nil, nil
	}
	where = append(where, activeOnly)
	qry := fmt.Sprintf(`SELECT * FROM "%s" WHERE %s LIMIT 1`, table.Name, strings.Join(where, " AND "))
	rows, err := querier.Query(ctx, qry, args...)
	if err != nil {
		return nil, fmt.Errorf("find unique %s: %w", table.Name, err)
	}
	results, err := collectRows(rows)
	if err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, nil
	}
	return normalizeRow(table, results[0]), nil
}

func (d *DB) ResetEntityPending(ctx context.Context, t Table, id string) error {
	_, err := d.Pool.Exec(ctx,
		fmt.Sprintf(`UPDATE "%s" SET "_fookie_status"='pending', "_fookie_error"=NULL WHERE "id"=$1`, t.Name),
		id)
	return err
}

func SetEntityStatusTx(transaction pgx.Tx, t Table, id, status string) error {
	_, err := transaction.Exec(context.Background(),
		fmt.Sprintf(`UPDATE "%s" SET "_fookie_status"=$1, "_fookie_error"=NULL WHERE "id"=$2`, t.Name),
		status, id)
	return err
}

func SetEntityHeadersTx(transaction pgx.Tx, t Table, id string, headersJSON []byte) error {
	_, err := transaction.Exec(context.Background(),
		fmt.Sprintf(`UPDATE "%s" SET "_fookie_headers"=$1 WHERE "id"=$2`, t.Name),
		string(headersJSON), id)
	return err
}

func (d *DB) Read(table Table, id string) (row.Map, error) {
	q := fmt.Sprintf(`SELECT * FROM "%s" WHERE "id" = $1 AND %s LIMIT 1`, table.Name, activeOnly)
	rows, err := d.Pool.Query(context.Background(), q, id)
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", table.Name, err)
	}
	results, err := collectRows(rows)
	if err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, fmt.Errorf("not_found")
	}
	return normalizeRow(table, results[0]), nil
}

func AdvisoryLock(transaction pgx.Tx, key string) error {
	h := fnv.New64a()
	_, _ = h.Write([]byte(key))
	lockKey := int64(h.Sum64())
	_, err := transaction.Exec(context.Background(), "SELECT pg_advisory_xact_lock($1)", lockKey)
	return err
}

func buildFilterClause(filter Filter, n int) (string, []any, error) {
	switch filter.Op {
	case opIn:
		return fmt.Sprintf(`"%s" = ANY($%d)`, filter.Field, n), []any{row.FilterDriver(filter.Value)}, nil
	case opNear:
		coordinateFilter, ok := filter.Value.(semantic.CoordinateFilter)
		if !ok {
			return "", nil, fmt.Errorf("buildFilterClause: @NEAR filter on field %q expects CoordinateFilter, got %T", filter.Field, filter.Value)
		}
		dLat := coordinateFilter.Radius / 111111.0
		dLon := coordinateFilter.Radius / (111111.0 * math.Cos(coordinateFilter.Lat*math.Pi/180.0))
		clause := fmt.Sprintf(`"%s" <@ box(point($%d,$%d),point($%d,$%d))`,
			filter.Field, n, n+1, n+2, n+3)
		return clause, []any{coordinateFilter.Lat - dLat, coordinateFilter.Lon - dLon, coordinateFilter.Lat + dLat, coordinateFilter.Lon + dLon}, nil
	case opBox:
		boxFilter, ok := filter.Value.(semantic.BoxFilter)
		if !ok {
			return "", nil, fmt.Errorf("buildFilterClause: @BOX filter on field %q expects BoxFilter, got %T", filter.Field, filter.Value)
		}
		clause := fmt.Sprintf(`"%s" <@ box(point($%d,$%d),point($%d,$%d))`,
			filter.Field, n, n+1, n+2, n+3)
		return clause, []any{boxFilter.MinLat, boxFilter.MinLon, boxFilter.MaxLat, boxFilter.MaxLon}, nil
	default:
		return fmt.Sprintf(`"%s" %s $%d`, filter.Field, filter.Op, n), []any{row.FilterDriver(filter.Value)}, nil
	}
}

func buildInsertParts(t Table, data row.Map) (cols []string, args []any, placeholders []string) {
	seen := map[string]bool{}
	i := 1
	for _, column := range t.Columns {
		if seen[column.Field] {
			continue
		}
		value, ok := data[column.Field]
		if !ok {
			continue
		}
		seen[column.Field] = true
		cols = append(cols, fmt.Sprintf(`"%s"`, column.Name))
		args = append(args, encodeVal(column, value))
		placeholders = append(placeholders, fmt.Sprintf("$%d", i))
		i++
	}
	return cols, args, placeholders
}

func encodeVal(c Column, v row.Cell) any {
	return v.DriverValue(c.IsJSON)
}

func normalizeRow(t Table, data row.Map) row.Map {
	if data == nil {
		return data
	}
	for _, c := range t.Columns {
		if c.Name == c.Field {
			continue
		}
		if v, ok := data[c.Name]; ok {
			data[c.Field] = v
		}
	}
	return data
}

func normalizeRows(t Table, rows []row.Map) []row.Map {
	for i := range rows {
		rows[i] = normalizeRow(t, rows[i])
	}
	return rows
}

func collectRows(rows pgx.Rows) ([]row.Map, error) {
	defer rows.Close()
	descs := rows.FieldDescriptions()
	var out []row.Map
	for rows.Next() {
		vals, err := rows.Values()
		if err != nil {
			return nil, err
		}
		rowMap := make(row.Map, len(descs))
		for i, d := range descs {
			rowMap[d.Name] = row.FromDriver(vals[i])
		}
		out = append(out, rowMap)
	}
	return out, rows.Err()
}
