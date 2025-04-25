import { expect } from "jsr:@std/expect"
import { DataSource } from "typeorm"
import { defaults, Field, Method, Model, TypeStandartization } from "@fookiejs/core"
import { database, initializeDataSource } from "../src/index.ts"
export * as pg from "pg"

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
		type: TypeStandartization.String,
		features: [defaults.feature.unique],
	})
	uniqueField!: string

	@Field.Decorator({
		type: TypeStandartization.String,
		features: [defaults.feature.required],
	})
	requiredField!: string

	@Field.Decorator({
		type: TypeStandartization.Integer,
		features: [],
	})
	integerField?: number

	@Field.Decorator({
		type: TypeStandartization.Float,
		features: [],
	})
	floatField?: number

	@Field.Decorator({
		type: TypeStandartization.Boolean,
		features: [],
	})
	booleanField?: boolean

	@Field.Decorator({
		type: TypeStandartization.Date,
		features: [],
	})
	dateField?: Date

	@Field.Decorator({
		type: TypeStandartization.String,
		features: [],
		isArray: true,
	})
	textArrayField?: string[]

	@Field.Decorator({
		type: TypeStandartization.String,
		features: [],
	})
	stringField?: string

	@Field.Decorator({
		type: TypeStandartization.Enum,
		enum: TestRole,
		features: [],
	})
	roleField?: TestRole
}

const TEST_RUN_ID = Date.now().toString(36) + Math.random().toString(36).substring(2, 5)

const getConfig = () => {
	const host = Deno.env.get("POSTGRES_HOST")
	const port = Deno.env.get("POSTGRES_PORT")
	const user = Deno.env.get("POSTGRES_USER")
	const password = Deno.env.get("POSTGRES_PASSWORD")

	if (!host || !port || !user || !password) {
		throw new Error(
			"Required environment variables are missing. Please set POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, and POSTGRES_PASSWORD",
		)
	}

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
	name: "PostgreSQL Basic Types and Features",
	async fn() {
		const config = getConfig()

		try {
			const tempConfig = { ...config, database: "postgres" }
			const tempDS = new DataSource(tempConfig as any)
			await tempDS.initialize()

			try {
				await tempDS.query(`
					SELECT pg_terminate_backend(pg_stat_activity.pid)
					FROM pg_stat_activity
					WHERE pg_stat_activity.datname = '${config.database}'
					AND pid <> pg_backend_pid()
				`)
				await tempDS.query(`DROP DATABASE IF EXISTS "${config.database}"`)
			} catch (error) {
				console.error("Failed to clean up existing database:", error instanceof Error ? error.message : String(error))
			}

			await tempDS.query(`CREATE DATABASE "${config.database}"`)
			await tempDS.destroy()

			await initializeDataSource(config as any)

			await PostgresTestModel.create({
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

			try {
				await PostgresTestModel.create({
					uniqueField: "unique2",
					requiredField: "",
				})
				expect(false).toBe(true)
			} catch (error) {
				expect(error instanceof Error).toBe(true)
			}

			const integerTest = await PostgresTestModel.create({
				requiredField: "integer_test",
				integerField: 42,
				uniqueField: "integer_unique",
			})
			const integerResult = await PostgresTestModel.read({
				filter: { id: { equals: integerTest.id } },
			})
			expect(integerResult[0].integerField).toBe(42)

			const floatTest = await PostgresTestModel.create({
				requiredField: "float_test",
				floatField: 3.14159,
				uniqueField: "float_unique",
			})
			const floatResult = await PostgresTestModel.read({
				filter: { id: { equals: floatTest.id } },
			})
			expect(floatResult[0].floatField).toBe(3.14159)

			const booleanTest = await PostgresTestModel.create({
				requiredField: "boolean_test",
				booleanField: true,
				uniqueField: "boolean_unique",
			})
			const booleanResult = await PostgresTestModel.read({
				filter: { id: { equals: booleanTest.id } },
			})
			expect(booleanResult[0].booleanField).toBe(true)

			const now = new Date()
			now.setHours(0, 0, 0, 0)
			const dateTest = await PostgresTestModel.create({
				requiredField: "date_test",
				dateField: now,
				uniqueField: "date_unique",
			})
			const dateResult = await PostgresTestModel.read({
				filter: { id: { equals: dateTest.id } },
			})
			const resultDate = new Date(dateResult[0].dateField)
			resultDate.setHours(0, 0, 0, 0)
			expect(resultDate.getTime()).toBe(now.getTime())

			const stringTest = await PostgresTestModel.create({
				requiredField: "string_test",
				stringField: "test string under 50 chars",
				uniqueField: "string_unique",
			})
			const stringResult = await PostgresTestModel.read({
				filter: { id: { equals: stringTest.id } },
			})
			expect(stringResult[0].stringField).toBe("test string under 50 chars")

			const arrayTest = await PostgresTestModel.create({
				requiredField: "array_test",
				textArrayField: ["one", "two", "three"],
				uniqueField: "array_unique",
			})
			const arrayResult = await PostgresTestModel.read({
				filter: { id: { equals: arrayTest.id } },
			})
			expect(JSON.stringify(arrayResult[0].textArrayField)).toBe(JSON.stringify(["one", "two", "three"]))

			const enumTest = await PostgresTestModel.create({
				requiredField: "enum_test",
				roleField: TestRole.ADMIN,
				uniqueField: "enum_unique",
			})
			const enumResult = await PostgresTestModel.read({
				filter: { id: { equals: enumTest.id } },
			})
			expect(enumResult[0].roleField).toBe(TestRole.ADMIN)

			try {
				await PostgresTestModel.create({
					requiredField: "string_test_long",
					stringField: "x".repeat(51),
					uniqueField: "string_unique_long",
				})
				expect(false).toBe(true)
			} catch (error) {
				expect(error instanceof Error).toBe(true)
			}

			try {
				await PostgresTestModel.create({
					requiredField: "enum_test_invalid",
					roleField: "INVALID_ROLE" as any,
					uniqueField: "enum_unique_invalid",
				})
				expect(false).toBe(true)
			} catch (error) {
				expect(error instanceof Error).toBe(true)
			}

			try {
				await PostgresTestModel.create({
					requiredField: "array_test_invalid",
					textArrayField: [1, 2, 3] as any,
					uniqueField: "array_unique_invalid",
				})
				expect(false).toBe(true)
			} catch (error) {
				expect(error instanceof Error).toBe(true)
			}
		} finally {
			try {
				const tempConfig = { ...config, database: "postgres" }
				const tempDS = new DataSource(tempConfig as any)
				await tempDS.initialize()

				await tempDS.query(`
					SELECT pg_terminate_backend(pg_stat_activity.pid)
					FROM pg_stat_activity
					WHERE pg_stat_activity.datname = '${config.database}'
					AND pid <> pg_backend_pid()
				`)

				await tempDS.query(`DROP DATABASE IF EXISTS "${config.database}"`)
				await tempDS.destroy()
			} catch (error) {
				console.error("Failed to clean up test database:", error instanceof Error ? error.message : String(error))
			}
		}
	},
})
