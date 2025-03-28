import { expect } from "jsr:@std/expect"
import { Randomize } from "@fookiejs/randomize"
import { Config, defaults, Utils } from "@fookiejs/core"

Deno.test("Randomize", () => {
	Deno.test("rastgele model oluşturabilmeli", async () => {
		for (let i = 0; i < 1000; i++) {
			const randomModel = Randomize.generateRandomModel(
				defaults.database.store,
				Math.floor(Math.random() * 100),
			)

			await randomModel.read({}, { sub: Config.SYSTEM_TOKEN })

			expect(randomModel).toBeDefined()
		}
	})
})
