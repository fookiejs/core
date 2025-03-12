import { describe, it, expect } from "vitest"
import { Config } from "@fookiejs/core"

// Testler
describe("Config", async () => {
    it("t1", async () => {
        Config.SYSTEM_TOKEN
    })

    it("t2", async () => {
        try {
            Config.get("INVALID_ENV")
        } catch (error) {
            return
        }

        expect(false).toBeTruthy()
    })
})
