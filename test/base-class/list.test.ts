import { describe, it, expect } from "vitest"
import {
    Effect,
    Filter,
    Modify,
    PreRule,
    Role,
    Rule,
    addPreRule,
    preRules,
} from "../../src/exports"
import * as lodash from "lodash"

describe("Base Class", async () => {
    it("List", async () => {
        expect(lodash.isArray(PreRule.list())).toBe(true)
        expect(lodash.isArray(Modify.list())).toBe(true)
        expect(lodash.isArray(Role.list())).toBe(true)
        expect(lodash.isArray(Rule.list())).toBe(true)
        expect(lodash.isArray(Filter.list())).toBe(true)
        expect(lodash.isArray(Effect.list())).toBe(true)
    })

    it("add pre rule", async () => {
        const key = "test-pre-rule-base-class"
        addPreRule(
            PreRule.new({
                key: key,
                execute: async function () {
                    return true
                },
            }),
        )

        expect(preRules.filter((pr) => pr.key === key)).length(1)
    })
})
