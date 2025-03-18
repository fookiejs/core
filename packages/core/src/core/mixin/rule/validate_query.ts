import { Rule } from "../../lifecycle-function.ts"
import { Type } from "../../type.ts"
import * as lodash from "npm:lodash-es"

function isValidFilterKey(type: Type, currentKey: string, value: any): boolean {
	if (type.queryController[currentKey].isArray) {
		return value.every((val: any) => type.queryController[currentKey].validate(val))
	}
	return type.queryController[currentKey].validate(value)
}

export default Rule.create({
	key: "validate_query",
	execute: async function (payload) {
		const filterKeys = lodash.keys(payload.query.filter!)
		const modelKeys = lodash.keys(payload.model.schema())

		const isValidObject = (key: string, validator: (val: any) => boolean) =>
			lodash.has(payload.query, key) &&
			!validator((payload.query as Record<string, any>)[key])

		if (isValidObject("filter", lodash.isObject)) return false
		if (isValidObject("limit", lodash.isNumber)) return false
		if (isValidObject("offset", lodash.isNumber)) return false

		if (lodash.difference(filterKeys, modelKeys).length > 0) return false

		for (const filterKey of filterKeys) {
			const currentKeys = lodash.keys(
				(payload.query.filter as Record<string, any>)[filterKey],
			)
			const type: Type = (payload.model.schema() as Record<string, any>)[
				filterKey
			].type

			const availableFilterKeys = lodash.keys(type.queryController)

			if (lodash.difference(currentKeys, availableFilterKeys).length !== 0) {
				return false
			}

			for (const currentKey of currentKeys) {
				const value = (payload.query.filter as Record<string, any>)[filterKey][
					currentKey
				]
				if (!isValidFilterKey(type, currentKey, value)) return false
			}
		}

		return true
	},
})
