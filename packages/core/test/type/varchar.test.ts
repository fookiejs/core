import { defaults, Field, FookieError, Model } from "@fookiejs/core"
import { expect } from "jsr:@std/expect"

@Model.Decorator({
	database: defaults.database.store,
	binds: { create: { role: [] } },
})
class VarcharModel extends Model {
	@Field.Decorator({
		type: defaults.type.varchar(10),
		features: [defaults.feature.required],
	})
	shortName!: string
}

@Model.Decorator({
	database: defaults.database.store,
	binds: { create: { role: [] } },
})
class MultiVarcharModel extends Model {
	@Field.Decorator({
		type: defaults.type.varchar(5),
		features: [defaults.feature.required],
	})
	code!: string

	@Field.Decorator({
		type: defaults.type.varchar(20),
		features: [defaults.feature.required],
	})
	name!: string

	@Field.Decorator({
		type: defaults.type.varchar(255),
		features: [],
	})
	description?: string
}

Deno.test("Varchar Type - Creation", async () => {
	const varcharType1 = defaults.type.varchar(10)
	const varcharType2 = defaults.type.varchar(20)
	const varcharType3 = defaults.type.varchar(30)
	const varcharType4 = defaults.type.varchar(255)

	expect(varcharType1.key).toBe("varchar(10)")
	expect(varcharType2.key).toBe("varchar(20)")
	expect(varcharType3.key).toBe("varchar(30)")
	expect(varcharType4.key).toBe("varchar(255)")

	expect(varcharType1.validate("a".repeat(10))).toBe(true)
	expect(varcharType1.validate("a".repeat(9))).toBe(true)
	expect(varcharType1.validate("a".repeat(11))).toBe(false)

	expect(varcharType1.validate(123)).toBe(false)
	expect(varcharType1.validate(null)).toBe(false)
	expect(varcharType1.validate(undefined)).toBe(false)
	expect(varcharType1.validate({})).toBe(false)
})

Deno.test("Varchar Type - Valid Creation", async () => {
	const exactLength = await VarcharModel.create({ shortName: "a".repeat(10) })
	expect(exactLength instanceof VarcharModel).toBe(true)
	expect(exactLength.shortName).toBe("a".repeat(10))

	const shorterLength = await VarcharModel.create({ shortName: "a".repeat(5) })
	expect(shorterLength instanceof VarcharModel).toBe(true)
	expect(shorterLength.shortName).toBe("a".repeat(5))

	const emptyString = await VarcharModel.create({ shortName: "" })
	expect(emptyString instanceof VarcharModel).toBe(true)
	expect(emptyString.shortName).toBe("")
})

Deno.test("Varchar Type - Invalid Creation", async () => {
	try {
		await VarcharModel.create({ shortName: "a".repeat(11) })
		expect(false).toBe(true)
	} catch (error) {
		expect(error instanceof FookieError).toBe(true)
	}

	try {
		await VarcharModel.create({ shortName: 12345 as any })
		expect(false).toBe(true)
	} catch (error) {
		expect(error instanceof FookieError).toBe(true)
	}
})

Deno.test("Varchar Type - Multiple Lengths", async () => {
	const valid = await MultiVarcharModel.create({
		code: "a".repeat(5),
		name: "a".repeat(15),
		description: "a".repeat(30),
	})
	expect(valid instanceof MultiVarcharModel).toBe(true)
	expect(valid.code).toBe("a".repeat(5))
	expect(valid.name).toBe("a".repeat(15))
	expect(valid.description).toBe("a".repeat(30))

	try {
		await MultiVarcharModel.create({
			code: "a".repeat(6),
			name: "a".repeat(10),
		})
		expect(false).toBe(true)
	} catch (error) {
		expect(error instanceof FookieError).toBe(true)
	}

	try {
		await MultiVarcharModel.create({
			code: "a".repeat(5),
			name: "a".repeat(21),
		})
		expect(false).toBe(true)
	} catch (error) {
		expect(error instanceof FookieError).toBe(true)
	}

	const noDescription = await MultiVarcharModel.create({
		code: "a".repeat(5),
		name: "a".repeat(10),
	})
	expect(noDescription instanceof MultiVarcharModel).toBe(true)
	expect(noDescription.description).toBeUndefined()
})

Deno.test("Varchar Type - Real World Use Case", async () => {
	@Model.Decorator({
		database: defaults.database.store,
		binds: { create: { role: [] } },
	})
	class User extends Model {
		@Field.Decorator({
			type: defaults.type.varchar(50),
			features: [defaults.feature.required],
		})
		username!: string

		@Field.Decorator({
			type: defaults.type.varchar(100),
			features: [defaults.feature.required],
		})
		email!: string

		@Field.Decorator({
			type: defaults.type.varchar(255),
			features: [],
		})
		bio?: string
	}

	const user = await User.create({
		username: "johndoe",
		email: "john.doe@example.com",
		bio: "a".repeat(200),
	})

	expect(user instanceof User).toBe(true)
	expect(user.username).toBe("johndoe")
	expect(user.email).toBe("john.doe@example.com")
	expect(user.bio).toBe("a".repeat(200))

	const longUsername = "a".repeat(51)
	try {
		await User.create({
			username: longUsername,
			email: "john.doe@example.com",
		})
		expect(false).toBe(true)
	} catch (error) {
		expect(error instanceof FookieError).toBe(true)
	}

	try {
		await User.create({
			username: "testuser",
			email: "very-long-email-" + "a".repeat(100) + "@example.com",
		})
		expect(false).toBe(true)
	} catch (error) {
		expect(error instanceof FookieError).toBe(true)
	}
})
