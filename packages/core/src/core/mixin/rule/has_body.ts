import * as lodash from "https://raw.githubusercontent.com/lodash/lodash/4.17.21-es/lodash.js"

import { Rule } from "../../lifecycle-function.ts"

export default Rule.create({
	key: "has_body",
	execute: async function (payload) {
		return lodash.has(payload, "body")
	},
})
