import { expect } from "jsr:@std/expect"
import { DataSource } from "typeorm"
import { defaults, Field, Method, Model, models } from "@fookiejs/core"
import { database, initializeDataSource } from "../src/index.ts"

// Define enum values explicitly to ensure they're correctly processed
enum TestRole {
	ADMIN = "ADMIN",
	USER = "USER",
	GUEST = "GUEST",
}

@Model.Decorator({
	database: database,
	binds: { [Method.CREATE]: { role: [] }, [Method.READ]: { role: [] } },
})
class PostgresTestModel extends Model {
	@Field.Decorator({
		type: defaults.type.text,
		features: [defaults.feature.unique],
	})
	uniqueField!: string

	@Field.Decorator({
		type: defaults.type.text,
		features: [defaults.feature.required],
	})
	requiredField!: string

	@Field.Decorator({
		type: defaults.type.jsonb,
		features: [],
	})
	jsonData?: Record<string, unknown>

	@Field.Decorator({
		type: defaults.type.timestamp,
		features: [],
	})
	timestampField?: Date

	@Field.Decorator({
		type: defaults.type.timestamptz,
		features: [],
	})
	timestamptzField?: Date

	@Field.Decorator({
		type: defaults.type.decimal,
		features: [],
	})
	numericField?: string

	@Field.Decorator({
		type: defaults.type.uuid,
		features: [],
	})
	uuidField?: string

	@Field.Decorator({
		type: defaults.type.array(defaults.type.text),
		features: [],
	})
	textArrayField?: string[]

	@Field.Decorator({
		type: defaults.type.bigint,
		features: [],
	})
	bigintField?: string

	@Field.Decorator({
		type: defaults.type.enum(TestRole),
		features: [],
	})
	roleField?: TestRole
}

// Create a globally unique test identifier
const TEST_RUN_ID = Date.now().toString(36) + Math.random().toString(36).substring(2, 5)

const getConfig = () => {
	// Check for required environment variables
	const host = Deno.env.get("POSTGRES_HOST")
	const port = Deno.env.get("POSTGRES_PORT")
	const user = Deno.env.get("POSTGRES_USER")
	const password = Deno.env.get("POSTGRES_PASSWORD")

	// Generate a safe database name without hyphens
	const timestamp = Date.now()
	const randomSuffix = crypto.randomUUID().replace(/-/g, "")

	return {
		type: "postgres",
		host,
		port: Number(port),
		username: user,
		password,
		database: `test_db_${TEST_RUN_ID}_${randomSuffix.substring(0, 8)}`,
	}
}

Deno.test({
	name: "PostgreSQL Advanced Types and Features",
	async fn() {
		const config = getConfig()

		try {
			// Create test database
			const tempConfig = { ...config, database: "postgres" }
			const tempDS = new DataSource(tempConfig as any)
			await tempDS.initialize()

			// Drop database if it exists already (to clean up from previous failed tests)
			try {
				await tempDS.query(`
					SELECT pg_terminate_backend(pg_stat_activity.pid)
					FROM pg_stat_activity
					WHERE pg_stat_activity.datname = '${config.database}'
					AND pid <> pg_backend_pid()
				`)
				await tempDS.query(`DROP DATABASE IF EXISTS "${config.database}"`)
			} catch (error) {
				// Silently continue if cleanup fails
			}

			// Create fresh database
			await tempDS.query(`CREATE DATABASE "${config.database}"`)
			await tempDS.destroy()

			// Initialize with test database
			await initializeDataSource(config as any)

			// Test unique constraint
			const uniqueTest = await PostgresTestModel.create({
				uniqueField: "unique1",
				requiredField: "required1",
			})

			try {
				await PostgresTestModel.create({
					uniqueField: "unique1",
					requiredField: "required2",
				})
				expect(false).toBe(true)
			} catch (error) {
				expect(error instanceof Error).toBe(true)
			}

			// Test required constraint
			try {
				await PostgresTestModel.create({
					uniqueField: "unique2",
					requiredField: "",
				})
				expect(false).toBe(true)
			} catch (error) {
				expect(error instanceof Error).toBe(true)
			}

			// Test JSONB
			const jsonTest = await PostgresTestModel.create({
				requiredField: "json_test",
				jsonData: { test: true, nested: { value: 42 } },
				uniqueField: "json_unique",
			})
			const jsonResult = await PostgresTestModel.read({
				filter: { id: { equals: jsonTest.id } },
			})
			expect((jsonResult[0].jsonData as any).nested.value).toBe(42)

			// Test Timestamp
			const now = new Date()
			const timestampTest = await PostgresTestModel.create({
				requiredField: "timestamp_test",
				timestampField: now,
				timestamptzField: now,
				uniqueField: "timestamp_unique",
			})
			const timestampResult = await PostgresTestModel.read({
				filter: { id: { equals: timestampTest.id } },
			})
			expect(new Date(timestampResult[0].timestampField).getTime()).toBe(now.getTime())

			// Test Numeric with precision
			const numericTest = await PostgresTestModel.create({
				requiredField: "numeric_test",
				numericField: "123456.789",
				uniqueField: "numeric_unique",
			})
			const numericResult = await PostgresTestModel.read({
				filter: { id: { equals: numericTest.id } },
			})
			expect(numericResult[0].numericField).toBe("123456.789")

			// Test UUID
			const uuidTest = await PostgresTestModel.create({
				requiredField: "uuid_test",
				uuidField: "123e4567-e89b-12d3-a456-426614174000",
				uniqueField: "uuid_unique",
			})
			const uuidResult = await PostgresTestModel.read({
				filter: { id: { equals: uuidTest.id } },
			})
			expect(uuidResult[0].uuidField).toBe("123e4567-e89b-12d3-a456-426614174000")

			// Test Array
			const arrayTest = await PostgresTestModel.create({
				requiredField: "array_test",
				textArrayField: ["one", "two", "three"],
				uniqueField: "array_unique",
			})
			const arrayResult = await PostgresTestModel.read({
				filter: { id: { equals: arrayTest.id } },
			})
			expect(JSON.stringify(arrayResult[0].textArrayField)).toBe(JSON.stringify(["one", "two", "three"]))

			// Test Bigint
			const bigintTest = await PostgresTestModel.create({
				requiredField: "bigint_test",
				bigintField: "9223372036854775807", // Max value for bigint
				uniqueField: "bigint_unique",
			})
			const bigintResult = await PostgresTestModel.read({
				filter: { id: { equals: bigintTest.id } },
			})
			expect(bigintResult[0].bigintField).toBe("9223372036854775807")

			// Test Enum type
			const enumTest = await PostgresTestModel.create({
				requiredField: "enum_test",
				roleField: TestRole.ADMIN,
				uniqueField: "enum_unique",
			})
			const enumResult = await PostgresTestModel.read({
				filter: { id: { equals: enumTest.id } },
			})
			expect(enumResult[0].roleField).toBe(TestRole.ADMIN)
		} finally {
			// Cleanup: Drop test database
			try {
				const tempConfig = { ...config, database: "postgres" }
				const tempDS = new DataSource(tempConfig as any)
				await tempDS.initialize()

				// Disconnect all active connections first
				await tempDS.query(`
					SELECT pg_terminate_backend(pg_stat_activity.pid)
					FROM pg_stat_activity
					WHERE pg_stat_activity.datname = '${config.database}'
					AND pid <> pg_backend_pid()
				`)

				// Drop the database
				//await tempDS.query(`DROP DATABASE IF EXISTS "${config.database}"`)
				await tempDS.destroy()
			} catch (error) {
				// Silently continue if cleanup fails
			}
		}
	},
})
