import { expect } from "jsr:@std/expect"
import {
	defaults,
	Effect,
	Field,
	Lifecycle,
	Method,
	Model,
	Modify,
	Role,
	Rule,
	TypeStandartization,
} from "@fookiejs/core"

Deno.test("Model.addLifecycle - should add Effect to binds", async () => {
	@Model.Decorator({
		database: defaults.database.store,
	})
	class TestModelEffect extends Model {
		@Field.Decorator({
			type: TypeStandartization.String,
			features: [defaults.feature.required],
		})
		name!: string
	}

	const testEffect = Effect.create({
		key: "test-effect",
		execute: async (payload, response) => {
			console.log("Effect executed")
		},
	})

	TestModelEffect.addLifecycle(Method.CREATE, testEffect)

	const binds = TestModelEffect.binds()
	expect(binds[Method.CREATE]?.[Lifecycle.EFFECT]).toBeDefined()
	expect(binds[Method.CREATE]?.[Lifecycle.EFFECT]?.length).toBe(1)
	expect(binds[Method.CREATE]?.[Lifecycle.EFFECT]?.[0].key).toBe("test-effect")
})

Deno.test("Model.addLifecycle - should add Role to binds", async () => {
	@Model.Decorator({
		database: defaults.database.store,
	})
	class TestModelRole extends Model {
		@Field.Decorator({
			type: TypeStandartization.String,
			features: [defaults.feature.required],
		})
		name!: string
	}

	const testRole = Role.create({
		key: "test-role",
		execute: async (payload) => {
			return true
		},
	})

	TestModelRole.addLifecycle(Method.READ, testRole)

	const binds = TestModelRole.binds()
	expect(binds[Method.READ]?.[Lifecycle.ROLE]).toBeDefined()
	// system role is added by default, so we expect 2
	expect(binds[Method.READ]?.[Lifecycle.ROLE]?.length).toBe(2)
	expect(binds[Method.READ]?.[Lifecycle.ROLE]?.[1].key).toBe("test-role")
})

Deno.test("Model.addLifecycle - should add Rule to binds", async () => {
	@Model.Decorator({
		database: defaults.database.store,
	})
	class TestModelRule extends Model {
		@Field.Decorator({
			type: TypeStandartization.String,
			features: [defaults.feature.required],
		})
		name!: string
	}

	const testRule = Rule.create({
		key: "test-rule",
		execute: async (payload) => {
			return false
		},
	})

	TestModelRule.addLifecycle(Method.UPDATE, testRule)

	const binds = TestModelRule.binds()
	expect(binds[Method.UPDATE]?.[Lifecycle.RULE]).toBeDefined()
	expect(binds[Method.UPDATE]?.[Lifecycle.RULE]?.length).toBe(1)
	expect(binds[Method.UPDATE]?.[Lifecycle.RULE]?.[0].key).toBe("test-rule")
})

Deno.test("Model.addLifecycle - should add Modify to binds", async () => {
	@Model.Decorator({
		database: defaults.database.store,
	})
	class TestModelModify extends Model {
		@Field.Decorator({
			type: TypeStandartization.String,
			features: [defaults.feature.required],
		})
		name!: string
	}

	const testModify = Modify.create({
		key: "test-modify",
		execute: async (payload) => {
			;(payload.body as any).name = "Modified"
		},
	})

	TestModelModify.addLifecycle(Method.CREATE, testModify)

	const binds = TestModelModify.binds()
	expect(binds[Method.CREATE]?.[Lifecycle.MODIFY]).toBeDefined()
	expect(binds[Method.CREATE]?.[Lifecycle.MODIFY]?.length).toBe(1)
	expect(binds[Method.CREATE]?.[Lifecycle.MODIFY]?.[0].key).toBe("test-modify")
})

Deno.test("Model.addLifecycle - should add multiple lifecycles", async () => {
	@Model.Decorator({
		database: defaults.database.store,
	})
	class TestModelMultiple extends Model {
		@Field.Decorator({
			type: TypeStandartization.String,
			features: [defaults.feature.required],
		})
		name!: string
	}

	const effect1 = Effect.create({
		key: "effect-1",
		execute: async () => {},
	})

	const effect2 = Effect.create({
		key: "effect-2",
		execute: async () => {},
	})

	const role1 = Role.create({
		key: "role-1",
		execute: async () => true,
	})

	TestModelMultiple.addLifecycle(Method.CREATE, effect1)
	TestModelMultiple.addLifecycle(Method.CREATE, effect2)
	TestModelMultiple.addLifecycle(Method.CREATE, role1)

	const binds = TestModelMultiple.binds()
	expect(binds[Method.CREATE]?.[Lifecycle.EFFECT]?.length).toBe(2)
	// system role is added by default, so we expect 2
	expect(binds[Method.CREATE]?.[Lifecycle.ROLE]?.length).toBe(2)
})

Deno.test("Model.addLifecycle - should work with existing binds", async () => {
	@Model.Decorator({
		database: defaults.database.store,
	})
	class TestModelExisting extends Model {
		@Field.Decorator({
			type: TypeStandartization.String,
			features: [defaults.feature.required],
		})
		name!: string
	}

	const role1 = Role.create({
		key: "role-1",
		execute: async () => true,
	})

	const role2 = Role.create({
		key: "role-2",
		execute: async () => true,
	})

	TestModelExisting.addLifecycle(Method.CREATE, role1)
	TestModelExisting.addLifecycle(Method.CREATE, role2)

	const binds = TestModelExisting.binds()
	// system role + 2 added roles = 3
	expect(binds[Method.CREATE]?.[Lifecycle.ROLE]?.length).toBe(3)
	expect(binds[Method.CREATE]?.[Lifecycle.ROLE]?.[1].key).toBe("role-1")
	expect(binds[Method.CREATE]?.[Lifecycle.ROLE]?.[2].key).toBe("role-2")
})

Deno.test("Model.addLifecycle - should preserve default binds", async () => {
	@Model.Decorator({
		database: defaults.database.store,
	})
	class TestModelDefaults extends Model {
		@Field.Decorator({
			type: TypeStandartization.String,
			features: [defaults.feature.required],
		})
		name!: string
	}

	const binds = TestModelDefaults.binds()

	// Check that system role is added by default to all methods
	expect(binds[Method.CREATE]?.[Lifecycle.ROLE]?.length).toBe(1)
	expect(binds[Method.CREATE]?.[Lifecycle.ROLE]?.[0].key).toBe("system")

	expect(binds[Method.READ]?.[Lifecycle.ROLE]?.length).toBe(1)
	expect(binds[Method.READ]?.[Lifecycle.ROLE]?.[0].key).toBe("system")

	expect(binds[Method.UPDATE]?.[Lifecycle.ROLE]?.length).toBe(1)
	expect(binds[Method.UPDATE]?.[Lifecycle.ROLE]?.[0].key).toBe("system")

	expect(binds[Method.DELETE]?.[Lifecycle.ROLE]?.length).toBe(1)
	expect(binds[Method.DELETE]?.[Lifecycle.ROLE]?.[0].key).toBe("system")
})
