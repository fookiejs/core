import * as lodash from "npm:lodash@^4.17.21"
import { Rule } from "../../lifecycle-function.ts"

export default Rule.create({
	key: "has_body",
	execute: async function (payload) {
		return lodash.has(payload, "body")
	},
})
