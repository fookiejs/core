import { string } from "../../../defaults/type/string.ts"

import * as lodash from "https://raw.githubusercontent.com/lodash/lodash/4.17.21-es/lodash.js"

import type { Field } from "../field.ts"

export function fillSchema(field: Field): Field {
	if (!lodash.has(field, "type")) {
		field.type = string
	}

	if (!lodash.has(field, "features")) {
		field.features = []
	}

	if (field.relation) {
		field.type = string
	}

	return field
}
