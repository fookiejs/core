import { store } from "./database/store.ts"
import { nobody } from "./role/nobody.ts"
import { system } from "./role/system.ts"
import { everybody } from "./role/everybody.ts"
import { Database } from "../database/database.ts"
import { Role } from "../lifecycle-function/lifecycle-function.ts"
import { CoreTypes } from "./type/types.ts"
type DefaultsType = {
	types: typeof CoreTypes
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
	types: CoreTypes,
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
