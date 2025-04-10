import { Config, defaults, Field, Method, Model } from "@fookiejs/core"
import { expect } from "jsr:@std/expect"
import { initAuth } from "../mod.ts"
import { assertEquals, assertRejects } from "https://deno.land/std@0.208.0/assert/mod.ts"
import { FookieError } from "../../core/mod.ts"
import { visibility } from "../src/index.ts"

const database = defaults.database.store
const { Account, visibleTo } = initAuth(database)

@Model.Decorator({
	database,
	binds: {
		[Method.CREATE]: {
			role: [defaults.role.system],
		},
		[Method.READ]: {
			role: [defaults.role.system],
		},
	},
})
class Company extends Model {
	@Field.Decorator({ type: defaults.type.text })
	name!: string
}

@Model.Decorator({
	database,
	binds: {
		[Method.CREATE]: {
			role: [defaults.role.system],
		},
		[Method.READ]: {
			role: [defaults.role.system],
		},
	},
})
class CompanyMember extends Model {
	@Field.Decorator({ type: defaults.type.text, relation: Account })
	accountId!: string

	@Field.Decorator({ type: defaults.type.text, relation: Company })
	companyId!: string
}

@Model.Decorator({
	database,
	binds: {
		[Method.CREATE]: {
			role: [defaults.role.system],
		},
		[Method.READ]: {
			role: [defaults.role.system],
		},
	},
})
class Team extends Model {
	@Field.Decorator({ type: defaults.type.text })
	name!: string

	@Field.Decorator({ type: defaults.type.text, relation: Company })
	companyId!: string
}

@Model.Decorator({
	database,
	binds: {
		[Method.CREATE]: {
			role: [defaults.role.system],
		},
		[Method.READ]: {
			role: [defaults.role.system],
		},
	},
})
class TeamMember extends Model {
	@Field.Decorator({ type: defaults.type.text, relation: Account })
	accountId!: string

	@Field.Decorator({ type: defaults.type.text, relation: Team })
	teamId!: string
}

@Model.Decorator({
	database,
	binds: {
		[Method.CREATE]: {
			role: [defaults.role.system],
		},
		[Method.READ]: {
			role: [defaults.role.system],
			modify: [visibleTo],
		},
	},
})
class Document extends Model {
	@Field.Decorator({ type: defaults.type.text })
	title!: string

	@Field.Decorator({ type: defaults.type.text })
	content!: string

	@Field.Decorator({ type: defaults.type.text, relation: Team })
	teamId!: string
}

Deno.test("Visibility Chain - User can see documents of their teams", async () => {
	// Create test data
	const account = await Account.create(
		{
			email: "test@test.com",
			iss: "test",
			sub: "test",
			name: "Test User",
			picture: "test.jpg",
		},
		{ token: Config.SYSTEM_TOKEN },
	)

	const company = await Company.create(
		{
			name: "Test Company",
		},
		{ token: Config.SYSTEM_TOKEN },
	)

	await CompanyMember.create(
		{
			accountId: account.id,
			companyId: company.id,
		},
		{ token: Config.SYSTEM_TOKEN },
	)

	const team = await Team.create(
		{
			name: "Test Team",
			companyId: company.id,
		},
		{ token: Config.SYSTEM_TOKEN },
	)

	await TeamMember.create(
		{
			accountId: account.id,
			teamId: team.id,
		},
		{ token: Config.SYSTEM_TOKEN },
	)

	const document = await Document.create(
		{
			title: "Test Document",
			content: "Test Content",
			teamId: team.id,
		},
		{ token: Config.SYSTEM_TOKEN },
	)

	// Create another team and document that user shouldn't see
	const otherTeam = await Team.create(
		{
			name: "Other Team",
			companyId: company.id,
		},
		{ token: Config.SYSTEM_TOKEN },
	)

	await Document.create(
		{
			title: "Other Document",
			content: "Other Content",
			teamId: otherTeam.id,
		},
		{ token: Config.SYSTEM_TOKEN },
	)

	// Test visibility
	const documents = await Document.read(
		{
			filter: {},
		},
		{
			token: `Bearer google_${account.id}`,
		},
	)

	expect(Array.isArray(documents)).toBe(true)
	expect(documents.length).toBe(1)
	expect(documents[0].id).toBe(document.id)
})

Deno.test("Visibility - Should throw error when no path to Account model exists", async () => {
	const modelWithoutAccountPath = {
		name: "IsolatedModel",
		fields: {},
		relations: {},
	}

	await assertRejects(
		async () => {
			await visibility(modelWithoutAccountPath)
		},
		FookieError,
		"No path found from IsolatedModel to Account model",
	)
})
