import { store } from "./database/store.ts"
import { string } from "./type/string.ts"
import { nobody } from "./role/nobody.ts"
import { system } from "./role/system.ts"
import { everybody } from "./role/everybody.ts"
import { date } from "./type/date.ts"
import { number } from "./type/number.ts"
import { boolean } from "./type/boolean.ts"
import { array } from "./type/array.ts"
import { Type } from "../core/type.ts"
import { Database } from "../core/database.ts"
import { Role } from "../core/lifecycle-function.ts"

type DefaultsType = {
	type: {
		string: Type
		date: Type
		number: Type
		boolean: Type
		array: (innerType: Type) => Type
	}
	database: {
		store: Database
	}
	role: {
		nobody: Role
		system: Role
		everybody: Role
	}
	feature: {
		required: symbol
		unique: symbol
	}
}

export const defaults: DefaultsType = {
	type: {
		string,
		date,
		number,
		boolean,
		array,
	},
	database: {
		store,
	},
	role: {
		nobody,
		system,
		everybody,
	},
	feature: {
		required: Symbol(),
		unique: Symbol(),
	},
} as const
