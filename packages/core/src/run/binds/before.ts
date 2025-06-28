import set_default from "../modify/set_default.ts"
import check_type from "../rule/check_type.ts"
import has_field from "../rule/has_field.ts"
import has_body from "../rule/has_body.ts"
import set_id from "../modify/set-id.ts"
import type { BindsType } from "../../model/model.ts"
import { Lifecycle } from "../lifecycle.ts"
import { Method } from "../../method/method.ts"

export const before: BindsType = {
	[Method.CREATE]: {
		[Lifecycle.MODIFY]: [set_id, set_default],
		[Lifecycle.ROLE]: [],
		[Lifecycle.RULE]: [has_body, has_field, check_type],
		[Lifecycle.FILTER]: [],
		[Lifecycle.EFFECT]: [],
	},
	[Method.READ]: {
		[Lifecycle.MODIFY]: [],
		[Lifecycle.ROLE]: [],
		[Lifecycle.RULE]: [],
		[Lifecycle.FILTER]: [],
		[Lifecycle.EFFECT]: [],
	},
	[Method.UPDATE]: {
		[Lifecycle.MODIFY]: [],
		[Lifecycle.ROLE]: [],
		[Lifecycle.RULE]: [has_body, has_field, check_type],
		[Lifecycle.FILTER]: [],
		[Lifecycle.EFFECT]: [],
	},
	[Method.DELETE]: {
		[Lifecycle.MODIFY]: [],
		[Lifecycle.ROLE]: [],
		[Lifecycle.RULE]: [],
		[Lifecycle.FILTER]: [],
		[Lifecycle.EFFECT]: [],
	},
}
