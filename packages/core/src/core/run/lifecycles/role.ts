import type { Payload } from "../../payload.ts"
import { before } from "../../mixin/binds/before.ts"
import { after } from "../../mixin/binds/after.ts"
import { FookieError } from "../../error.ts"
import type { Model } from "../../model/model.ts"
import type { Method } from "../../method.ts"
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

	for (const role of roles) {
		using _roleSpan = DisposableSpan.add(role.key)

		const res = await role.execute(payload)
		if (res) {
			payload.state.acceptedRoles.push(role)
			return true
		} else {
			payload.state.rejectedRoles.push(role)
		}
	}

	throw FookieError.create({
		message: `Access denied. None of the required roles were satisfied.`,
		status: 403,
		code: "ACCESS_DENIED",
	})
}

export default role
