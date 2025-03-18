import { string } from "../../../defaults/type/string.ts"

import * as lodash from "https://deno.land/x/lodash_es@v0.0.2/mod.ts"
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
