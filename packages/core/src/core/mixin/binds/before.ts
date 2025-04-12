import set_default from "../modify/set_default.ts"
import check_type from "../rule/check_type.ts"
import has_field from "../rule/has_field.ts"
import has_body from "../rule/has_body.ts"
import set_id from "../modify/set-id.ts"
import type { BindsType } from "../../model/model.ts"

export const before: BindsType = {
	create: {
		modify: [set_id, set_default],
		role: [],
		rule: [has_body, has_field, check_type],
		filter: [],
		effect: [],
	},
	read: {
		modify: [],
		role: [],
		rule: [],
		filter: [],
		effect: [],
	},
	update: {
		modify: [],
		role: [],
		rule: [has_body, has_field, check_type],
		filter: [],
		effect: [],
	},
	delete: {
		modify: [],
		role: [],
		rule: [],
		filter: [],
		effect: [],
	},
}
