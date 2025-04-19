import { Rule } from "../../lifecycle-function/lifecycle-function.ts"
import { Type } from "../../type/type.ts"
import * as lodash from "lodash"

function isValidFilterKey(type: Type, currentKey: string, value: any): boolean {
	const queryValidator = type.queryController[currentKey]

	if (queryValidator.isArray) {
		return Array.isArray(value) && value.every((val: any) => type.validate(val))
	}

	return type.validate(value)
}

export default Rule.create({
	key: "validate_query",
	execute: async function (payload) {
		const filterKeys = lodash.keys(payload.query.filter!)
		const modelKeys = lodash.keys(payload.model.schema())

		const isValidObject = (key: string, validator: (val: any) => boolean) =>
			lodash.has(payload.query, key) &&
			!validator(payload.query[key])

		if (isValidObject("filter", lodash.isObject)) {
			return false
		}

		if (isValidObject("limit", lodash.isNumber)) {
			return false
		}

		if (isValidObject("offset", lodash.isNumber)) {
			return false
		}

		if (isValidObject("orderBy", lodash.isObject)) {
			return false
		}

		if (lodash.difference(filterKeys, modelKeys).length > 0) {
			return false
		}

		const schema = payload.model.schema()

		for (const filterKey of filterKeys) {
			const currentKeys = lodash.keys(
				payload.query.filter[filterKey],
			)
			const type: Type = schema[filterKey].type

			const availableFilterKeys = lodash.keys(type.queryController)

			if (lodash.difference(currentKeys, availableFilterKeys).length !== 0) {
				return false
			}

			for (const currentKey of currentKeys) {
				const value = payload.query.filter[filterKey][
					currentKey
				]
				if (!isValidFilterKey(type, currentKey, value)) {
					return false
				}
			}
		}

		return true
	},
})
