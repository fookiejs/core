import { describe, it, expect } from "vitest"
import { LifecycleFunction } from "../../src/exports"
import * as lodash from "lodash"

// Testler
describe("Base Class", async () => {
    it("test", async () => {
        expect(lodash.isArray(LifecycleFunction.list())).toBe(true)
    })
})
