import validate_query from "../rule/validate_query.ts"
import filter_fields from "../modify/filter_fields.ts"
import has_entity from "../rule/has_entity.ts"
import check_required from "../rule/check_required.ts"
import attributes from "../filter/attributes.ts"
import validate_body from "../rule/validate_body.ts"
import type { BindsType } from "../../model/model.ts"
import set_dates from "../modify/set_dates.ts"
import { Lifecycle } from "../lifecycle.ts"
import { Method } from "../../method/method.ts"

export const after: BindsType = {
	[Method.CREATE]: {
		[Lifecycle.MODIFY]: [set_dates, filter_fields],
		[Lifecycle.RULE]: [has_entity, check_required, validate_body],
		[Lifecycle.ROLE]: [],
		[Lifecycle.FILTER]: [attributes],
		[Lifecycle.EFFECT]: [],
	},
	[Method.READ]: {
		[Lifecycle.MODIFY]: [filter_fields],
		[Lifecycle.RULE]: [validate_query],
		[Lifecycle.FILTER]: [attributes],
		[Lifecycle.EFFECT]: [],
		[Lifecycle.ROLE]: [],
	},
	[Method.UPDATE]: {
		[Lifecycle.MODIFY]: [set_dates],
		[Lifecycle.RULE]: [has_entity, validate_query, check_required, validate_body],
		[Lifecycle.FILTER]: [],
		[Lifecycle.EFFECT]: [],
		[Lifecycle.ROLE]: [],
	},
	[Method.DELETE]: {
		[Lifecycle.MODIFY]: [set_dates],
		[Lifecycle.RULE]: [validate_query],
		[Lifecycle.FILTER]: [],
		[Lifecycle.EFFECT]: [],
		[Lifecycle.ROLE]: [],
	},
}
