import { BaseClass } from "../base-class/base-class.ts"

export class Type extends BaseClass {
	validate!: (value: unknown) => boolean
	example!: unknown
	queryController!: {
		[key: string]: _QueryValidator
	}
	alias: string[]
}

class _QueryValidator {
	key!: string
	isArray?: boolean
}
