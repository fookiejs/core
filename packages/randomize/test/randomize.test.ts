import { expect } from "jsr:@std/expect"

import * as lodash from "https://deno.land/x/lodash_es@v0.0.2/mod.ts"
import { Randomize } from "@fookiejs/randomize"
import { Config, defaults } from "@fookiejs/core"

Deno.test("Randomize", () => {
	Deno.test("rastgele model oluşturabilmeli", async () => {
		for (let i = 0; i < 1000; i++) {
			const randomModel = Randomize.generateRandomModel(
				defaults.database.store,
				Math.floor(Math.random() * 100),
			)
			console.log(lodash.keys(randomModel.schema()).length)

			const response = await randomModel.read({}, { sub: Config.SYSTEM_TOKEN })

			console.log(randomModel.getName(), response)

			expect(randomModel).toBeDefined()
		}
	})
})
