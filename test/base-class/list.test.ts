import { describe, it, expect } from "vitest"
import { Effect, Filter, Modify, PreRule, Role, Rule } from "../../src/exports"
import * as lodash from "lodash"

// Testler
describe("Base Class", async () => {
    it("test", async () => {
        expect(lodash.isArray(PreRule.list())).toBe(true)
        expect(lodash.isArray(Modify.list())).toBe(true)
        expect(lodash.isArray(Role.list())).toBe(true)
        expect(lodash.isArray(Rule.list())).toBe(true)
        expect(lodash.isArray(Filter.list())).toBe(true)
        expect(lodash.isArray(Effect.list())).toBe(true)
    })
})
