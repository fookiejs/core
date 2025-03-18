import { string } from "../../defaults/type/string.ts"
import { Utils } from "@fookiejs/core/src/utils/util.ts"
import type { Model } from "../model/model.ts"
import { schemaSymbol } from "../model/model.ts"
import type { Type } from "../type.ts"
import { fillSchema } from "./utils/fill-schema.ts"

export class Field {
	required?: boolean
	type?: Type
	unique?: boolean
	uniqueGroup?: string[]
	default?: unknown
	validators?: [(value: unknown) => boolean | string]
	relation?: typeof Model
	features?: symbol[]

	static Decorator(field: Field) {
		return function (target: any, propertyKey: any) {
			const metadata = Reflect.getMetadata(schemaSymbol, target.constructor) ||
				{}

			if (!Utils.has(metadata, "id")) {
				metadata["id"] = fillSchema({
					type: string,
				})
			}

			metadata[propertyKey] = fillSchema(field)

			Reflect.defineMetadata(schemaSymbol, metadata, target.constructor)
		}
	}
}
