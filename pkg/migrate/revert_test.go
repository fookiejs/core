package migrate

import (
	"reflect"
	"testing"
)

func TestSplitStatements(t *testing.T) {
	in := `CREATE TABLE IF NOT EXISTS "audit_logs" ("id" UUID);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tx ON "audit_logs"("id");
`
	got := splitStatements(in)
	want := []string{
		`CREATE TABLE IF NOT EXISTS "audit_logs" ("id" UUID)`,
		`CREATE INDEX IF NOT EXISTS idx_audit_logs_tx ON "audit_logs"("id")`,
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("splitStatements mismatch\nwant: %#v\ngot:  %#v", want, got)
	}
}

func TestInvertSingleStatement(t *testing.T) {
	tests := []struct {
		name           string
		statement      string
		forceDropTable bool
		want           string
		wantErr        bool
	}{
		{
			name:      "alter add column",
			statement: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email" VARCHAR(255)`,
			want:      `ALTER TABLE "users" DROP COLUMN IF EXISTS "email"`,
		},
		{
			name:      "create index quoted",
			statement: `CREATE UNIQUE INDEX IF NOT EXISTS "uniq_users_email_0" ON "users" ("email" ASC)`,
			want:      `DROP INDEX IF EXISTS "uniq_users_email_0"`,
		},
		{
			name:      "create index unquoted",
			statement: `CREATE INDEX IF NOT EXISTS idx_outbox_status ON "outbox"("status")`,
			want:      `DROP INDEX IF EXISTS "idx_outbox_status"`,
		},
		{
			name:           "create table with force",
			statement:      `CREATE TABLE IF NOT EXISTS "users" ("id" UUID)`,
			forceDropTable: true,
			want:           `DROP TABLE IF EXISTS "users" CASCADE`,
		},
		{
			name:      "create table without force",
			statement: `CREATE TABLE IF NOT EXISTS "users" ("id" UUID)`,
			wantErr:   true,
		},
	}

	for _, tc := range tests {
		tc := tc
		t.Run(tc.name, func(t *testing.T) {
			got, err := invertSingleStatement(tc.statement, tc.forceDropTable)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got none")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got != tc.want {
				t.Fatalf("unexpected inverse statement\nwant: %s\ngot:  %s", tc.want, got)
			}
		})
	}
}

func TestInvertMigrationStatementOrder(t *testing.T) {
	statement := `CREATE TABLE IF NOT EXISTS "audit_logs" ("id" UUID);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tx ON "audit_logs"("id");
CREATE INDEX IF NOT EXISTS idx_audit_logs_usr ON "audit_logs"("id")`
	got, err := invertMigrationStatement(statement, true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := []string{
		`DROP INDEX IF EXISTS "idx_audit_logs_usr"`,
		`DROP INDEX IF EXISTS "idx_audit_logs_tx"`,
		`DROP TABLE IF EXISTS "audit_logs" CASCADE`,
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("invert order mismatch\nwant: %#v\ngot:  %#v", want, got)
	}
}
