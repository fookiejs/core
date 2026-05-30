package store

import (
	"context"
	"fmt"
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

func (database *DB) Begin(ctx context.Context) (pgx.Tx, error) {
	return database.Pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.Serializable})
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

func (database *DB) Migrate(tables []Table) error {
	for _, table := range tables {
		if err := database.migrateTable(table); err != nil {
			return fmt.Errorf("migrate %s: %w", table.Name, err)
		}
	}
	return nil
}

func (database *DB) migrateTable(table Table) error {
	cols := []string{`"id" TEXT PRIMARY KEY`}
	for _, column := range table.Columns {
		if column.IsID {
			continue
		}
		cols = append(cols, fmt.Sprintf(`"%s" %s`, column.Name, column.SQLType))
	}
	query := fmt.Sprintf(`CREATE TABLE IF NOT EXISTS "%s" (%s)`, table.Name, strings.Join(cols, ", "))
	if _, err := database.Pool.Exec(context.Background(), query); err != nil {
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
		if _, err := database.Pool.Exec(ctx, query); err != nil {
			return fmt.Errorf("alter table %s: %w", table.Name, err)
		}
	}

	for _, column := range table.Columns {
		if column.IsID {
			continue
		}
		if _, err := database.Pool.Exec(context.Background(),
			fmt.Sprintf(`ALTER TABLE "%s" ADD COLUMN IF NOT EXISTS "%s" %s`, table.Name, column.Name, column.SQLType)); err != nil {
			return fmt.Errorf("add column %s.%s: %w", table.Name, column.Name, err)
		}
	}

	for _, column := range table.Columns {
		if !column.Indexed {
			continue
		}
		idx := fmt.Sprintf(`CREATE INDEX IF NOT EXISTS "%s_%s_idx" ON "%s" ("%s")`, table.Name, column.Name, table.Name, column.Name)
		if _, err := database.Pool.Exec(context.Background(), idx); err != nil {
			return fmt.Errorf("index %s.%s: %w", table.Name, column.Field, err)
		}
	}
	for _, column := range table.Columns {
		if !column.Unique || column.IsID {
			continue
		}
		idx := fmt.Sprintf(`CREATE UNIQUE INDEX IF NOT EXISTS "%s_%s_unique_idx" ON "%s" ("%s") WHERE %s`, table.Name, column.Name, table.Name, column.Name, activeOnly)
		if _, err := database.Pool.Exec(context.Background(), idx); err != nil {
			return fmt.Errorf("unique index %s.%s: %w", table.Name, column.Field, err)
		}
	}
	return nil
}

func InsertTx(transaction pgx.Tx, table Table, data row.Values) (row.Values, error) {
	cols, args, placeholders := buildInsertParts(table, data)
	if len(cols) == 0 {
		return nil, fmt.Errorf("insert %s: empty row", table.Name)
	}
	query := fmt.Sprintf(`INSERT INTO "%s" (%s) VALUES (%s) RETURNING *`,
		table.Name, strings.Join(cols, ", "), strings.Join(placeholders, ", "))
	return execReturning(context.Background(), transaction, table, query, args, fmt.Errorf("insert %s: no rows returned", table.Name))
}

func UpdateTx(transaction pgx.Tx, table Table, identifier string, data row.Values) (row.Values, error) {
	if len(data) == 0 {
		return ReadTx(transaction, table, identifier)
	}
	var sets []string
	var args []any
	placeholder := 1
	for _, column := range table.Columns {
		if column.IsID {
			continue
		}
		cell, ok := data.Find(column.Field)
		if !ok {
			continue
		}
		sets = append(sets, fmt.Sprintf(`"%s" = $%d`, column.Name, placeholder))
		args = append(args, encodeVal(column, cell))
		placeholder++
	}
	if len(sets) == 0 {
		return ReadTx(transaction, table, identifier)
	}
	args = append(args, identifier)
	query := fmt.Sprintf(`UPDATE "%s" SET %s WHERE "id" = $%d RETURNING *`,
		table.Name, strings.Join(sets, ", "), placeholder)
	return execReturning(context.Background(), transaction, table, query, args, fmt.Errorf("not_found"))
}

func DeleteTx(transaction pgx.Tx, table Table, identifier, updatedAt string) error {
	tag, err := transaction.Exec(context.Background(),
		fmt.Sprintf(`UPDATE "%s" SET "is_deleted" = true, "updated_at" = $1 WHERE "id" = $2 AND %s`, table.Name, activeOnly),
		updatedAt, identifier)
	if err != nil {
		return fmt.Errorf("delete %s: %w", table.Name, err)
	}
	if tag.RowsAffected() == 0 {
		return fmt.Errorf("not_found")
	}
	return nil
}

func ReadTx(transaction pgx.Tx, table Table, identifier string) (row.Values, error) {
	return readByID(context.Background(), transaction, table, identifier)
}

func SumTx(transaction pgx.Tx, table Table, column, excludeID string, filters []Filter) (int64, error) {
	var where []string
	var args []any
	placeholder := 1
	for _, filter := range filters {
		clause, clauseArguments, err := buildFilterClause(filter, placeholder)
		if err != nil {
			return 0, err
		}
		where = append(where, clause)
		args = append(args, clauseArguments...)
		placeholder += len(clauseArguments)
	}
	if excludeID != "" {
		where = append(where, fmt.Sprintf(`"id" != $%d`, placeholder))
		args = append(args, excludeID)
	}
	where = append(where, activeOnly)
	where = append(where, `"_fookie_status" = 'active'`)

	query := fmt.Sprintf(`SELECT COALESCE(SUM("%s"), 0) FROM "%s"`, column, table.Name)
	if len(where) > 0 {
		query += " WHERE " + strings.Join(where, " AND ")
	}

	var total int64
	err := transaction.QueryRow(context.Background(), query, args...).Scan(&total)
	return total, err
}

func (database *DB) List(table Table, query Query) ([]row.Values, error) {
	return ListQuerier(context.Background(), database.Pool, table, query)
}

func ListTx(ctx context.Context, transaction pgx.Tx, table Table, query Query) ([]row.Values, error) {
	return ListQuerier(ctx, transaction, table, query)
}

func ListQuerier(ctx context.Context, querier Querier, table Table, query Query) ([]row.Values, error) {
	sql, args, err := buildListSQL(table, query)
	if err != nil {
		return nil, err
	}
	rows, err := querier.Query(ctx, sql, args...)
	if err != nil {
		return nil, fmt.Errorf("list %s: %w", table.Name, err)
	}
	out, err := collectRows(rows)
	if err != nil {
		return nil, err
	}
	return normalizeRows(table, out), nil
}

func buildListSQL(table Table, query Query) (string, []any, error) {
	var where []string
	var args []any
	placeholder := 1
	where = append(where, activeOnly)
	for _, filter := range query.Filters {
		clause, clauseArguments, err := buildFilterClause(filter, placeholder)
		if err != nil {
			return "", nil, err
		}
		where = append(where, clause)
		args = append(args, clauseArguments...)
		placeholder += len(clauseArguments)
	}
	switch query.CursorDir {
	case CursorAfter:
		where = append(where, fmt.Sprintf(`"id" > $%d`, placeholder))
		args = append(args, query.Cursor)
	case CursorBefore:
		where = append(where, fmt.Sprintf(`"id" < $%d`, placeholder))
		args = append(args, query.Cursor)
	}
	sql := fmt.Sprintf(`SELECT * FROM "%s"`, table.Name)
	if len(where) > 0 {
		sql += " WHERE " + strings.Join(where, " AND ")
	}
	if len(query.Orders) > 0 {
		parts := make([]string, 0, len(query.Orders))
		for _, order := range query.Orders {
			direction := "ASC"
			if order.Desc {
				direction = "DESC"
			}
			parts = append(parts, fmt.Sprintf(`"%s" %s`, order.Field, direction))
		}
		sql += " ORDER BY " + strings.Join(parts, ", ")
	}
	limit := query.Limit
	if limit <= 0 {
		limit = 50
	}
	sql += fmt.Sprintf(" LIMIT %d", limit)
	return sql, args, nil
}

func FindExistingByUnique(ctx context.Context, querier Querier, table Table, data row.Values) (row.Values, error) {
	var where []string
	var args []any
	placeholder := 1
	for _, column := range table.Columns {
		if !column.Unique || column.IsID {
			continue
		}
		cell, ok := data.Find(column.Field)
		if !ok || cell.Kind == row.KindEmpty {
			continue
		}
		if cell.Kind == row.KindText && cell.Text == "" {
			continue
		}
		where = append(where, fmt.Sprintf(`"%s" = $%d`, column.Name, placeholder))
		args = append(args, encodeVal(column, cell))
		placeholder++
	}
	if len(where) == 0 {
		return nil, nil
	}
	where = append(where, activeOnly)
	sql := fmt.Sprintf(`SELECT * FROM "%s" WHERE %s LIMIT 1`, table.Name, strings.Join(where, " AND "))
	rows, err := querier.Query(ctx, sql, args...)
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

func (database *DB) ResetEntityPending(ctx context.Context, table Table, identifier string) error {
	_, err := database.Pool.Exec(ctx,
		fmt.Sprintf(`UPDATE "%s" SET "_fookie_status"='pending', "_fookie_error"=NULL WHERE "id"=$1`, table.Name),
		identifier)
	return err
}

func SetEntityStatusTx(transaction pgx.Tx, table Table, identifier, status string) error {
	_, err := transaction.Exec(context.Background(),
		fmt.Sprintf(`UPDATE "%s" SET "_fookie_status"=$1, "_fookie_error"=NULL WHERE "id"=$2`, table.Name),
		status, identifier)
	return err
}

func SetEntityHeadersTx(transaction pgx.Tx, table Table, identifier string, headersJSON []byte) error {
	_, err := transaction.Exec(context.Background(),
		fmt.Sprintf(`UPDATE "%s" SET "_fookie_headers"=$1 WHERE "id"=$2`, table.Name),
		string(headersJSON), identifier)
	return err
}

func (database *DB) Read(table Table, identifier string) (row.Values, error) {
	return readByID(context.Background(), database.Pool, table, identifier)
}

func readByID(ctx context.Context, querier Querier, table Table, identifier string) (row.Values, error) {
	query := fmt.Sprintf(`SELECT * FROM "%s" WHERE "id" = $1 AND %s LIMIT 1`, table.Name, activeOnly)
	rows, err := querier.Query(ctx, query, identifier)
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

func execReturning(ctx context.Context, transaction pgx.Tx, table Table, query string, args []any, noRowsErr error) (row.Values, error) {
	rows, err := transaction.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("exec %s: %w", table.Name, err)
	}
	results, err := collectRows(rows)
	if err != nil {
		return nil, err
	}
	if len(results) == 0 {
		return nil, noRowsErr
	}
	return normalizeRow(table, results[0]), nil
}

func buildFilterClause(filter Filter, placeholder int) (string, []any, error) {
	switch filter.Op {
	case opIn:
		return fmt.Sprintf(`"%s" = ANY($%d)`, filter.Field, placeholder), []any{row.FilterDriver(filter.Value)}, nil
	case opNear:
		coordinateFilter, ok := filter.Value.(semantic.CoordinateFilter)
		if !ok {
			return "", nil, fmt.Errorf("buildFilterClause: @NEAR filter on field %q expects CoordinateFilter, got %T", filter.Field, filter.Value)
		}
		deltaLat := coordinateFilter.Radius / 111111.0
		deltaLon := coordinateFilter.Radius / (111111.0 * math.Cos(coordinateFilter.Lat*math.Pi/180.0))
		clause := fmt.Sprintf(`"%s" <@ box(point($%d,$%d),point($%d,$%d))`,
			filter.Field, placeholder, placeholder+1, placeholder+2, placeholder+3)
		return clause, []any{coordinateFilter.Lat - deltaLat, coordinateFilter.Lon - deltaLon, coordinateFilter.Lat + deltaLat, coordinateFilter.Lon + deltaLon}, nil
	case opBox:
		boxFilter, ok := filter.Value.(semantic.BoxFilter)
		if !ok {
			return "", nil, fmt.Errorf("buildFilterClause: @BOX filter on field %q expects BoxFilter, got %T", filter.Field, filter.Value)
		}
		clause := fmt.Sprintf(`"%s" <@ box(point($%d,$%d),point($%d,$%d))`,
			filter.Field, placeholder, placeholder+1, placeholder+2, placeholder+3)
		return clause, []any{boxFilter.MinLat, boxFilter.MinLon, boxFilter.MaxLat, boxFilter.MaxLon}, nil
	default:
		return fmt.Sprintf(`"%s" %s $%d`, filter.Field, filter.Op, placeholder), []any{row.FilterDriver(filter.Value)}, nil
	}
}

func buildInsertParts(table Table, data row.Values) (cols []string, args []any, placeholders []string) {
	placeholder := 1
	for _, column := range table.Columns {
		cell, ok := data.Find(column.Field)
		if !ok {
			continue
		}
		cols = append(cols, fmt.Sprintf(`"%s"`, column.Name))
		args = append(args, encodeVal(column, cell))
		placeholders = append(placeholders, fmt.Sprintf("$%d", placeholder))
		placeholder++
	}
	return cols, args, placeholders
}

func encodeVal(column Column, cell row.Cell) any {
	return cell.DriverValue(column.IsJSON)
}

func normalizeRow(table Table, data row.Values) row.Values {
	for _, column := range table.Columns {
		if column.Name == column.Field {
			continue
		}
		if cell, ok := data.Find(column.Name); ok {
			data = data.Upsert(column.Field, cell)
		}
	}
	return data
}

func normalizeRows(table Table, records []row.Values) []row.Values {
	for index := range records {
		records[index] = normalizeRow(table, records[index])
	}
	return records
}

func collectRows(rows pgx.Rows) ([]row.Values, error) {
	defer rows.Close()
	descs := rows.FieldDescriptions()
	var out []row.Values
	for rows.Next() {
		vals, err := rows.Values()
		if err != nil {
			return nil, err
		}
		record := make(row.Values, len(descs))
		for index, desc := range descs {
			record[index] = row.Field{Column: desc.Name, Cell: row.FromDriver(vals[index])}
		}
		out = append(out, record)
	}
	return out, rows.Err()
}
