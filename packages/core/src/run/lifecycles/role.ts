import { DisposableSpan } from "../../otel/index.ts"
import { Payload } from "../../payload/payload.ts"
import { Model } from "../../model/model.ts"
import { Method } from "../../method/method.ts"
import { FookieError } from "../../error/error.ts"
import { before } from "../binds/before.ts"
import { after } from "../binds/after.ts"
import { Lifecycle } from "../lifecycle.ts"

const role = async function (payload: Payload<Model, Method>) {
	const roles = [
		...before[payload.method]![Lifecycle.ROLE]!,
		...payload.model.binds()![payload.method]![Lifecycle.ROLE]!,
		...after[payload.method]![Lifecycle.ROLE]!,
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
		status: 401,
		code: "ACCESS_DENIED",
	})
}

export default role
