package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	_ "github.com/lib/pq"

	"github.com/fookiejs/fookie/pkg/ast"
	"github.com/fookiejs/fookie/pkg/migrate"
	schemapkg "github.com/fookiejs/fookie/pkg/schema"
)

const cliVersion = "0.1.0"

const usage = `Fookie CLI v` + cliVersion + `

Usage:
  fookie init <dir>                    scaffold schema/schema.go + .env
  fookie compile [--schema] [--out]      validate or write schema.bundle.json
  fookie doctor                        check required tools
  fookie serve      [--schema] [--db] [--port]   start fookie-server
  fookie migrate plan    [--schema] [--db]        show pending DDL
  fookie migrate apply   [--schema] [--db] [--label]  apply DDL
  fookie migrate history [--db]                   show applied migrations
  fookie migration generate [--schema] [--db] [--dir] [--name]  write pending DDL to file
  fookie migration run      [--schema] [--db] [--label]         apply pending DDL
  fookie migration revert   [--db] [--steps N] [--force-drop-table]  revert last applied migration(s)
  fookie dlq list        [--db] [--limit N]       list failed jobs
  fookie dlq retry <id>  [--db]                   re-queue one job
  fookie dlq retry-all   [--db]                   re-queue all failed jobs
  fookie dlq purge       [--db] [--before date]   delete old failures
  fookie helm <args>                   passthrough to helm

Common flags:
  --schema <path>   path to schema.bundle.json or directory (env: SCHEMA_PATH)
  --db <url>        PostgreSQL connection string   (env: DB_URL)

See docs/getting-started.md for a full walkthrough.
`

func main() {
	if len(os.Args) < 2 {
		fmt.Fprint(os.Stderr, usage)
		os.Exit(2)
	}

	switch os.Args[1] {
	case "dlq":
		cmdDLQ(os.Args[2:])
	case "migrate":
		cmdMigrate(os.Args[2:])
	case "migration":
		cmdMigration(os.Args[2:])
	case "serve":
		cmdServe(os.Args[2:])
	case "init":
		cmdInit(os.Args[2:])
	case "compile":
		cmdCompile(os.Args[2:])
	case "doctor":
		cmdDoctor()
	case "version", "--version", "-v":
		fmt.Printf("fookie v%s\n", cliVersion)
	case "help", "--help", "-h":
		fmt.Print(usage)
	// Legacy docker/helm wrappers kept for backward compat
	case "helm":
		root, _ := findRepoRoot()
		hargs := os.Args[2:]
		if len(hargs) == 0 {
			hargs = []string{"template", "fookie", filepath.Join("charts", "fookie")}
		}
		run(root, "helm", hargs...)
	default:
		fmt.Fprintf(os.Stderr, "unknown command: %s\n\n%s", os.Args[1], usage)
		os.Exit(2)
	}
}

// ── dlq ──────────────────────────────────────────────────────────────────────

func cmdDLQ(args []string) {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "dlq needs a subcommand: list | retry <id> | retry-all | purge")
		os.Exit(2)
	}

	fs := flag.NewFlagSet("dlq", flag.ExitOnError)
	dbURL := fs.String("db", envOr("DB_URL", "postgres://fookie:fookie_dev@localhost:5432/fookie?sslmode=disable"), "PostgreSQL connection string")
	limit := fs.Int("limit", 50, "Max rows to list")
	beforeStr := fs.String("before", "", "Purge items created before this date (YYYY-MM-DD)")

	sub := args[0]
	fs.Parse(args[1:])

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	db := openDB(*dbURL)
	defer db.Close()

	switch sub {
	case "list":
		rows, err := db.QueryContext(ctx,
			`SELECT id, external_name, entity_type, entity_id, retry_count, error_message, created_at
			 FROM outbox WHERE status='failed'
			 ORDER BY created_at DESC LIMIT $1`, *limit)
		if err != nil {
			fatal(err)
		}
		defer rows.Close()
		fmt.Printf("%-36s  %-20s  %-5s  %s\n", "ID", "EXTERNAL", "RETRY", "ERROR (truncated)")
		fmt.Println(strings.Repeat("-", 90))
		n := 0
		for rows.Next() {
			var id, extName, eType string
			var eID sql.NullString
			var retryCount int
			var errMsg sql.NullString
			var createdAt time.Time
			if err := rows.Scan(&id, &extName, &eType, &eID, &retryCount, &errMsg, &createdAt); err != nil {
				fatal(err)
			}
			msg := ""
			if errMsg.Valid {
				msg = errMsg.String
				if len(msg) > 30 {
					msg = msg[:30] + "…"
				}
			}
			fmt.Printf("%-36s  %-20s  %-5d  %s\n", id, extName, retryCount, msg)
			n++
		}
		if n == 0 {
			fmt.Println("No failed items in the dead-letter queue.")
		}

	case "retry":
		if fs.NArg() == 0 {
			fmt.Fprintln(os.Stderr, "usage: fookie dlq retry <id>")
			os.Exit(2)
		}
		id := fs.Arg(0)
		res, err := db.ExecContext(ctx,
			`UPDATE outbox SET status='pending', retry_count=0, error_message=NULL, run_after=NULL
			 WHERE id=$1 AND status='failed'`, id)
		if err != nil {
			fatal(err)
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			fmt.Fprintf(os.Stderr, "item %s not found or not in failed status\n", id)
			os.Exit(1)
		}
		fmt.Printf("✓ Re-queued %s\n", id)

	case "retry-all":
		res, err := db.ExecContext(ctx,
			`UPDATE outbox SET status='pending', retry_count=0, error_message=NULL, run_after=NULL
			 WHERE status='failed'`)
		if err != nil {
			fatal(err)
		}
		n, _ := res.RowsAffected()
		fmt.Printf("✓ Re-queued %d failed item(s)\n", n)

	case "purge":
		var before time.Time
		if *beforeStr != "" {
			var err error
			before, err = time.Parse("2006-01-02", *beforeStr)
			if err != nil {
				fatal(fmt.Errorf("invalid --before date %q (want YYYY-MM-DD): %w", *beforeStr, err))
			}
		} else {
			before = time.Now().AddDate(0, 0, -30) // default: 30 days ago
		}
		res, err := db.ExecContext(ctx,
			`DELETE FROM outbox WHERE status='failed' AND created_at < $1`, before)
		if err != nil {
			fatal(err)
		}
		n, _ := res.RowsAffected()
		fmt.Printf("✓ Purged %d failed item(s) older than %s\n", n, before.Format("2006-01-02"))

	default:
		fmt.Fprintf(os.Stderr, "unknown dlq subcommand: %s\n", sub)
		os.Exit(2)
	}
}

// ── migrate ──────────────────────────────────────────────────────────────────

func cmdMigrate(args []string) {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "migrate needs a subcommand: plan | apply | history")
		os.Exit(2)
	}

	fs := flag.NewFlagSet("migrate", flag.ExitOnError)
	schemaPath := fs.String("schema", envOr("SCHEMA_PATH", "schema.bundle.json"), "Path to schema bundle or directory")
	dbURL := fs.String("db", envOr("DB_URL", "postgres://fookie:fookie_dev@localhost:5432/fookie?sslmode=disable"), "PostgreSQL connection string")
	label := fs.String("label", "manual-"+time.Now().Format("20060102-150405"), "Migration label (apply only)")

	sub := args[0]
	fs.Parse(args[1:])

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	switch sub {
	case "plan":
		stmts, err := loadPlannedStatements(ctx, *schemaPath, *dbURL)
		if err != nil {
			fatal(err)
		}
		if len(stmts) == 0 {
			fmt.Println("✓ Schema is up to date — nothing to migrate.")
			return
		}
		fmt.Printf("-- %d pending statement(s) --\n", len(stmts))
		for _, s := range stmts {
			fmt.Println(s)
			fmt.Println(";")
		}

	case "apply":
		n, err := applyPlannedStatements(ctx, *schemaPath, *dbURL, *label)
		if err != nil {
			fmt.Fprintf(os.Stderr, "apply failed after %d statements: %v\n", n, err)
			os.Exit(1)
		}
		fmt.Printf("✓ Applied %d statement(s) (label: %s)\n", n, *label)

	case "history":
		db := openDB(*dbURL)
		defer db.Close()
		rows, err := migrate.History(ctx, db)
		if err != nil {
			fatal(err)
		}
		if len(rows) == 0 {
			fmt.Println("No migrations recorded yet.")
			return
		}
		fmt.Printf("%-5s  %-24s  %-8s  %s\n", "ID", "APPLIED AT", "LABEL", "STATEMENT (truncated)")
		fmt.Println(strings.Repeat("-", 80))
		for _, r := range rows {
			stmt := fmt.Sprintf("%v", r["statement"])
			if len(stmt) > 40 {
				stmt = stmt[:40] + "…"
			}
			fmt.Printf("%-5v  %-24v  %-8v  %s\n", r["id"], r["applied_at"], r["label"], stmt)
		}

	default:
		fmt.Fprintf(os.Stderr, "unknown migrate subcommand: %s\n", sub)
		os.Exit(2)
	}
}

func cmdMigration(args []string) {
	if len(args) == 0 {
		fmt.Fprintln(os.Stderr, "migration needs a subcommand: generate | run | revert")
		os.Exit(2)
	}

	fs := flag.NewFlagSet("migration", flag.ExitOnError)
	schemaPath := fs.String("schema", envOr("SCHEMA_PATH", "schema.bundle.json"), "Path to schema bundle or directory")
	dbURL := fs.String("db", envOr("DB_URL", "postgres://fookie:fookie_dev@localhost:5432/fookie?sslmode=disable"), "PostgreSQL connection string")
	label := fs.String("label", "manual-"+time.Now().Format("20060102-150405"), "Migration label (run only)")
	dir := fs.String("dir", "migrations", "Directory to write generated migration file")
	name := fs.String("name", "", "Optional migration name for generated file")
	steps := fs.Int("steps", 1, "Number of most recent migrations to revert")
	forceDropTable := fs.Bool("force-drop-table", false, "Allow reverting CREATE TABLE statements")

	sub := args[0]
	fs.Parse(args[1:])

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	switch sub {
	case "generate":
		stmts, err := loadPlannedStatements(ctx, *schemaPath, *dbURL)
		if err != nil {
			fatal(err)
		}
		if len(stmts) == 0 {
			fmt.Println("✓ Schema is up to date — nothing to generate.")
			return
		}
		path, err := writeMigrationFile(*dir, *name, stmts)
		if err != nil {
			fatal(err)
		}
		fmt.Printf("✓ Generated migration file: %s\n", path)
	case "run":
		n, err := applyPlannedStatements(ctx, *schemaPath, *dbURL, *label)
		if err != nil {
			fmt.Fprintf(os.Stderr, "run failed after %d statements: %v\n", n, err)
			os.Exit(1)
		}
		fmt.Printf("✓ Applied %d statement(s) (label: %s)\n", n, *label)
	case "revert":
		if *steps <= 0 {
			fatal(fmt.Errorf("--steps must be greater than 0"))
		}
		db := openDB(*dbURL)
		defer db.Close()
		n, err := migrate.Revert(ctx, db, migrate.RevertOptions{
			Steps:          *steps,
			ForceDropTable: *forceDropTable,
		})
		if err != nil {
			fatal(err)
		}
		if n == 0 {
			fmt.Println("No migrations recorded yet.")
			return
		}
		fmt.Printf("✓ Reverted %d migration record(s)\n", n)
	default:
		fmt.Fprintf(os.Stderr, "unknown migration subcommand: %s\n", sub)
		os.Exit(2)
	}
}

// ── serve ────────────────────────────────────────────────────────────────────

func cmdServe(args []string) {
	// Delegates to cmd/server binary if available; otherwise prints guidance.
	serverBin, err := exec.LookPath("fookie-server")
	if err != nil {
		// Try to find it relative to this binary
		self, _ := os.Executable()
		candidate := filepath.Join(filepath.Dir(self), "fookie-server")
		if _, e := os.Stat(candidate); e == nil {
			serverBin = candidate
		}
	}
	if serverBin == "" {
		fmt.Fprintln(os.Stderr, "fookie-server not found in PATH. Build it with: go build ./cmd/server")
		os.Exit(1)
	}
	cmd := exec.Command(serverBin, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	if err := cmd.Run(); err != nil {
		os.Exit(1)
	}
}

// ── init ─────────────────────────────────────────────────────────────────────

func cmdInit(args []string) {
	dir := "."
	if len(args) > 0 {
		dir = args[0]
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		fatal(err)
	}
	schemaDir := filepath.Join(dir, "schema")
	if err := os.MkdirAll(schemaDir, 0o755); err != nil {
		fatal(err)
	}
	schemaFile := filepath.Join(schemaDir, "schema.go")
	if _, err := os.Stat(schemaFile); err == nil {
		fmt.Printf("schema/schema.go already exists — skipping.\n")
	} else {
		if err := os.WriteFile(schemaFile, []byte(initSchemaTemplate), 0o644); err != nil {
			fatal(err)
		}
		fmt.Printf("Created %s\n", schemaFile)
	}

	envFile := filepath.Join(dir, ".env")
	if _, err := os.Stat(envFile); err == nil {
		fmt.Printf(".env already exists in %s — skipping.\n", dir)
	} else {
		if err := os.WriteFile(envFile, []byte(initEnvTemplate), 0o644); err != nil {
			fatal(err)
		}
		fmt.Printf("Created %s\n", envFile)
	}

	fmt.Println()
	fmt.Println("Next steps:")
	fmt.Println("  1. Edit schema/schema.go")
	fmt.Println("  2. cd schema && go run .")
	fmt.Printf("  3. fookie serve --schema %s/schema\n", dir)
}

func cmdCompile(args []string) {
	fs := flag.NewFlagSet("compile", flag.ExitOnError)
	in := fs.String("schema", "schema/schema.bundle.json", "schema bundle path")
	fs.Parse(args)

	if _, err := schemapkg.LoadBundle(*in); err != nil {
		fatal(fmt.Errorf("invalid schema bundle %q: %w", *in, err))
	}
	fmt.Printf("OK %s\n", *in)
}

// ── doctor ───────────────────────────────────────────────────────────────────

func cmdDoctor() {
	checks := []struct {
		name string
		fn   func() (string, bool)
	}{
		{"docker", func() (string, bool) {
			_, err := exec.LookPath("docker")
			if err != nil {
				return "not found in PATH", false
			}
			out, _ := exec.Command("docker", "version", "--format", "{{.Server.Version}}").Output()
			return "v" + strings.TrimSpace(string(out)), true
		}},
		{"go", func() (string, bool) {
			out, err := exec.Command("go", "version").Output()
			if err != nil {
				return "not found in PATH", false
			}
			return strings.TrimSpace(string(out)), true
		}},
		{"helm (optional)", func() (string, bool) {
			out, err := exec.Command("helm", "version", "--short").Output()
			if err != nil {
				return "not found (optional)", true // not a hard requirement
			}
			return strings.TrimSpace(string(out)), true
		}},
		{"fookie-server", func() (string, bool) {
			if _, err := exec.LookPath("fookie-server"); err == nil {
				return "found in PATH", true
			}
			self, _ := os.Executable()
			candidate := filepath.Join(filepath.Dir(self), "fookie-server")
			if _, e := os.Stat(candidate); e == nil {
				return "found next to fookie binary", true
			}
			return "not found — run: go build ./cmd/server -o fookie-server", false
		}},
	}

	ok := true
	for _, c := range checks {
		detail, pass := c.fn()
		mark := "✓"
		if !pass {
			mark = "✗"
			ok = false
		}
		fmt.Printf("[%s] %-20s %s\n", mark, c.name, detail)
	}
	if !ok {
		os.Exit(1)
	}
}

// ── helpers ──────────────────────────────────────────────────────────────────

func loadSchema(path string) (*ast.Schema, error) {
	return schemapkg.LoadSchema(path)
}

func loadPlannedStatements(ctx context.Context, schemaPath, dbURL string) ([]string, error) {
	schema, err := loadSchema(schemaPath)
	if err != nil {
		return nil, err
	}
	db := openDB(dbURL)
	defer db.Close()
	return migrate.Plan(ctx, schema, db)
}

func applyPlannedStatements(ctx context.Context, schemaPath, dbURL, label string) (int, error) {
	schema, err := loadSchema(schemaPath)
	if err != nil {
		return 0, err
	}
	db := openDB(dbURL)
	defer db.Close()
	stmts, err := migrate.Plan(ctx, schema, db)
	if err != nil {
		return 0, err
	}
	if len(stmts) == 0 {
		fmt.Println("✓ Schema is up to date — nothing to apply.")
		return 0, nil
	}
	return migrate.Apply(ctx, db, stmts, label)
}

func writeMigrationFile(dir, name string, stmts []string) (string, error) {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	base := time.Now().Format("20060102150405")
	if cleaned := sanitizeMigrationName(name); cleaned != "" {
		base += "_" + cleaned
	}
	fullPath := filepath.Join(dir, base+".sql")
	var b strings.Builder
	for _, stmt := range stmts {
		s := strings.TrimSpace(stmt)
		if s == "" {
			continue
		}
		b.WriteString(s)
		if !strings.HasSuffix(s, ";") {
			b.WriteString(";")
		}
		b.WriteString("\n\n")
	}
	if err := os.WriteFile(fullPath, []byte(strings.TrimRight(b.String(), "\n")+"\n"), 0o644); err != nil {
		return "", err
	}
	return fullPath, nil
}

func sanitizeMigrationName(name string) string {
	name = strings.TrimSpace(strings.ToLower(name))
	if name == "" {
		return ""
	}
	var b strings.Builder
	lastUnderscore := false
	for _, r := range name {
		isAlphaNum := (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9')
		if isAlphaNum {
			b.WriteRune(r)
			lastUnderscore = false
			continue
		}
		if !lastUnderscore {
			b.WriteByte('_')
			lastUnderscore = true
		}
	}
	return strings.Trim(b.String(), "_")
}

func openDB(url string) *sql.DB {
	db, err := sql.Open("postgres", url)
	if err != nil {
		fatal(fmt.Errorf("open db: %w", err))
	}
	db.SetMaxOpenConns(5)
	db.SetConnMaxLifetime(30 * time.Second)
	return db
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func fatal(err error) {
	fmt.Fprintln(os.Stderr, "error:", err)
	os.Exit(1)
}

func findRepoRoot() (string, error) {
	wd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	dir := wd
	for {
		if _, err := os.Stat(filepath.Join(dir, "go.mod")); err == nil {
			return dir, nil
		}
		parent := filepath.Dir(dir)
		if parent == dir {
			return "", fmt.Errorf("go.mod not found from %s", wd)
		}
		dir = parent
	}
}

func run(dir, name string, arg ...string) {
	cmd := exec.Command(name, arg...)
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	if err := cmd.Run(); err != nil {
		os.Exit(1)
	}
}

// ── templates ────────────────────────────────────────────────────────────────

var initSchemaTemplate = `package main

import (
	"os"

	"github.com/fookiejs/fookie/pkg/ast"
	schemapkg "github.com/fookiejs/fookie/pkg/schema"
)

func build() *ast.Schema {
	return &ast.Schema{
		Models: []*ast.Model{
			{
				Name: "User",
				Fields: []*ast.Field{
					{Name: "name", Type: ast.TypeString, Validators: []ast.Validator{{Name: "required"}}},
					{Name: "email", Type: ast.TypeEmail, Constraints: []string{"--unique"}, Validators: []ast.Validator{{Name: "required"}}},
				},
				CRUD: map[string]*ast.Operation{
					"create": {Type: "create"},
					"read":   {Type: "read"},
					"update": {Type: "update"},
					"delete": {Type: "delete"},
				},
			},
		},
	}
}

func main() {
	data, err := schemapkg.MarshalBundle(build())
	if err != nil {
		panic(err)
	}
	if err := os.WriteFile("schema.bundle.json", data, 0o644); err != nil {
		panic(err)
	}
}
`

var initEnvTemplate = `# Fookie environment — fill in your values
DB_URL=postgres://fookie:fookie_dev@localhost:5432/fookie?sslmode=disable
REDIS_URL=redis://localhost:6379
SCHEMA_PATH=./schema
PORT=:8080
`
