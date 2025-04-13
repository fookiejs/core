import { Utils } from "../../utils/util.ts"
import { Rule } from "../../lifecycle-function/lifecycle-function.ts"

export default Rule.create({
	key: "has_body",
	execute: async function (payload) {
		return Utils.has(payload, "body")
	},
})
