import type { Model } from "../model/model.ts"
import { schemaSymbol } from "../model/model.ts"
import type { Type } from "../type.ts"
import { fillSchema } from "./utils/fill-schema.ts"
import * as lodash from "lodash"

export class Field {
	type?: Type
	uniqueGroup?: string[]
	default?: unknown
	validators?: [(value: unknown) => boolean | string]
	relation?: typeof Model
	features?: symbol[]

	static Decorator(field: Field): (constructor: typeof Model, descriptor: any) => void {
		return function (_value: any, descriptor: any) {
			if (!lodash.isObject(descriptor.metadata[schemaSymbol])) {
				descriptor.metadata[schemaSymbol] = {}
			}

			descriptor.metadata[schemaSymbol][descriptor.name] = fillSchema(field)
		}
	}
}
