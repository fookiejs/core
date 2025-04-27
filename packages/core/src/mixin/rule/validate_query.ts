import { Rule } from "../../lifecycle-function/lifecycle-function.ts"
import * as lodash from "lodash"
import { CoreTypes } from "../../type/types.ts"
import { TypeStandartization } from "../../type/standartization.ts"

function isValidFilterKey(type: TypeStandartization, currentKey: string, value: any): boolean {
	if (lodash.isNull(value)) return true

	const queryValidator = CoreTypes[type].queryController[currentKey]

	if (queryValidator.isArray) {
		if (Array.isArray(value) && value.some((val) => lodash.isNull(val))) {
			return false
		}
		return Array.isArray(value) && value.every((val) => CoreTypes[type].validate(val))
	}

	return CoreTypes[type].validate(value)
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
			const type = schema[filterKey].type as TypeStandartization

			const availableFilterKeys = lodash.keys(CoreTypes[type].queryController)

			if (lodash.difference(currentKeys, availableFilterKeys).length !== 0) {
				console.log(lodash.difference(currentKeys, availableFilterKeys), 111, filterKey)
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
