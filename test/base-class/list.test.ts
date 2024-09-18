import { describe, it, expect } from "vitest"
import { Effect, Filter, Modify, Role, Rule, addGlobalRule, globalRules } from "../../src/exports"
import * as lodash from "lodash"

describe("Base Class", async () => {
    it("List", async () => {
        expect(lodash.isArray(Modify.list())).toBe(true)
        expect(lodash.isArray(Role.list())).toBe(true)
        expect(lodash.isArray(Rule.list())).toBe(true)
        expect(lodash.isArray(Filter.list())).toBe(true)
        expect(lodash.isArray(Effect.list())).toBe(true)
    })

    it("add pre rule", async () => {
        const key = "test-pre-rule-base-class"
        addGlobalRule(
            Rule.new({
                key: key,
                execute: async function () {
                    return true
                },
            }),
        )

        expect(globalRules.filter((pr) => pr.key === key)).length(1)
    })
})
