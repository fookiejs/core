import type { Payload } from "../../payload.ts"
import { before } from "../../mixin/binds/before.ts"
import { after } from "../../mixin/binds/after.ts"
import { FookieError } from "../../error.ts"
import type { Model } from "../../model/model.ts"
import type { Method } from "../../method.ts"
import * as lodash from "lodash"
import { DisposableSpan } from "../../../otel/index.ts"

const role = async function (payload: Payload<Model, Method>) {
	const roles = [
		...before[payload.method]!.role!,
		...payload.model.binds()![payload.method]!.role!,
		...after[payload.method]!.role!,
	]
	using _span = DisposableSpan.add(`role`)
	if (roles.length === 0) {
		return true
	}

	for (let i = 0; i < roles.length; i++) {
		using _roleSpan = DisposableSpan.add(roles[i].key)

		const role = roles[i]
		const res = await role.execute(payload)
		const field = payload.model.binds()[payload.method]!

		if (res) {
			const extra_rule_responses: boolean[] = []

			const modifies = lodash.flatten(
				(field.accepts || [])
					.filter((r) => r[0] === role)
					?.map((item) => item[1].modify),
			)

			for (const modify of modifies) {
				using _modifySpan = DisposableSpan.add("role:modify", modify.key)
				await modify.execute(payload)
			}

			const extra_rules = lodash.flatten(
				(field.accepts || [])
					.filter((r) => r[0] === role)
					?.map((item) => item[1].rule),
			)

			for (const rule of extra_rules) {
				using _ruleSpan = DisposableSpan.add("role:rule", rule.key)
				const extra_rule_response = await rule.execute(payload)
				extra_rule_responses.push(extra_rule_response)
			}

			if (extra_rule_responses.includes(false)) {
				throw FookieError.create({
					message: "accepts:extra_rule",
					validationErrors: {},
					name: role.key,
				})
			}

			break
		} else {
			const extra_rule_responses: boolean[] = []

			const modifies = lodash.flatten(
				(field.rejects || [])
					.filter((r) => r[0] === role)
					?.map((item) => item[1].modify),
			)

			for (const modify of modifies) {
				using _modifySpan = DisposableSpan.add("role:modify", modify.key)
				await modify.execute(payload)
			}

			if (modifies.length > 0) {
				extra_rule_responses.push(true)
			}

			const extra_rules = lodash.flatten(
				(field.rejects || [])
					.filter((r) => r[0] === role)
					?.map((item) => item[1].rule),
			)

			for (const rule of extra_rules) {
				using _ruleSpan = DisposableSpan.add("role:rule", rule.key)
				const extra_rule_response = await rule.execute(payload)
				extra_rule_responses.push(extra_rule_response)
			}

			if (
				extra_rule_responses.includes(false) ||
				extra_rule_responses.length === 0
			) {
				throw FookieError.create({
					message: "rejects:extra_rule",
					validationErrors: {},
					name: role.key,
				})
			}

			if (extra_rule_responses.length === 0) {
				break
			}
		}
	}

	return true
}

export default role
