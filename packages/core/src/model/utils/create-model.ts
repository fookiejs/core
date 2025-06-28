import * as lodash from "lodash"
import { methods } from "../../method/method.ts"
import { system } from "../../defaults/role/system.ts"
import { Lifecycle, lifecycles } from "../../run/lifecycle.ts"
import { type BindsType, type BindsTypeField, type ModelTypeInput, type ModelTypeOutput } from "../../model/model.ts"

export function fillModel(model: ModelTypeInput): ModelTypeOutput {
	const binds: BindsType = {}
	model.mixins = lodash.isArray(model.mixins) ? model.mixins : []

	for (const method of methods) {
		binds[method] = {
			[Lifecycle.MODIFY]: [],
			[Lifecycle.ROLE]: [system],
			[Lifecycle.RULE]: [],
			[Lifecycle.FILTER]: [],
			[Lifecycle.EFFECT]: [],
		}

		for (const lifecycle of lifecycles) {
			if (!lodash.isArray(binds[method][lifecycle])) {
				binds[method][lifecycle] = []
			}
		}
	}

	if (model.mixins.length > 0) {
		for (const mixin of model.mixins) {
			if (lodash.isObject(mixin)) {
				for (const method of methods) {
					if (lodash.isObject(mixin.binds[method])) {
						binds[method] = lodash.mergeWith(
							binds[method],
							mixin.binds[method],
							(objValue: any, srcValue: any) => {
								if (lodash.isArray(objValue)) {
									return objValue.concat(objValue, srcValue)
								} else {
									return objValue
								}
							},
						)
					}
				}
			}
		}
	}

	return {
		...model,
		binds,
	} as ModelTypeOutput
}
