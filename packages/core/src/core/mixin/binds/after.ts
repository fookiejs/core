import validate_query from "../rule/validate_query.ts"
import filter_fields from "../modify/filter_fields.ts"
import has_entity from "../rule/has_entity.ts"
import check_required from "../rule/check_required.ts"
import attributes from "../filter/attributes.ts"
import validate_body from "../rule/validate_body.ts"
import type { BindsType } from "../../model/model.ts"
import set_dates from "../modify/set_dates.ts"

export const after: BindsType = {
	create: {
		modify: [set_dates, filter_fields],
		rule: [has_entity, check_required, validate_body],
		role: [],
		filter: [attributes],
		effect: [],
	},
	read: {
		modify: [filter_fields],
		rule: [validate_query],
		filter: [attributes],
		effect: [],
		role: [],
	},
	update: {
		modify: [set_dates],
		rule: [has_entity, validate_query, check_required, validate_body],
		filter: [],
		effect: [],
		role: [],
	},
	delete: {
		modify: [set_dates],
		rule: [validate_query],
		filter: [],
		effect: [],
		role: [],
	},
}
