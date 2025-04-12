import type { Model } from "../model/model.ts"
import { schemaSymbol } from "../model/model.ts"
import type { Type } from "../type.ts"
import { fillSchema } from "./utils/fill-schema.ts"
import * as lodash from "lodash"

interface FookieDecoratorContext {
	metadata?: {
		[schemaSymbol]?: Record<string, Field>
		[key: symbol]: any
	}
	name?: string | symbol
}

export class Field {
	type?: Type
	default?: unknown
	validators?: [(value: unknown) => boolean | string]
	relation?: typeof Model
	features?: symbol[]

	static Decorator(field: Field): (target: any, descriptor: FookieDecoratorContext) => void {
		return function (_value: any, descriptor: FookieDecoratorContext) {
			if (!descriptor || !descriptor.metadata) {
				console.error("Field decorator missing descriptor or metadata for property:", descriptor?.name)
				if (!descriptor) descriptor = {}
				if (!descriptor.metadata) descriptor.metadata = {}
			}

			if (!lodash.isObject(descriptor.metadata[schemaSymbol])) {
				descriptor.metadata[schemaSymbol] = {}
			}

			if (descriptor.name) {
				const key = String(descriptor.name)
				const schemaContainer = descriptor.metadata[schemaSymbol] as Record<string, Field>
				if (schemaContainer) {
					schemaContainer[key] = fillSchema(field)
				}
			} else {
				console.error("Field decorator is missing property name ('descriptor.name').")
			}
		}
	}
}
