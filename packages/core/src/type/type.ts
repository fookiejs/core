import { plainToClass } from "class-transformer"
import { TypeStandartization } from "./standartization.ts"

export class Type {
	example?: any
	type!: TypeStandartization
	validate!: (value: unknown) => boolean
	queryController!: {
		[key: string]: _QueryValidator
	}

	static create(data: Type): Type {
		return plainToClass(Type, data)
	}
}

class _QueryValidator {
	key!: string
	isArray?: boolean
}
