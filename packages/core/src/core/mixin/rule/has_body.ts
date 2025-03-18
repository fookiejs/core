import * as lodash from "https://deno.land/x/lodash_es@v0.0.2/mod.ts"
import { Rule } from "../../lifecycle-function.ts"

export default Rule.create({
	key: "has_body",
	execute: async function (payload) {
		return lodash.has(payload, "body")
	},
})
