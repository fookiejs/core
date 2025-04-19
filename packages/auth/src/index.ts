import {
	Config,
	Database,
	defaults,
	Effect,
	Field,
	FookieError,
	globalPreModifies,
	Method,
	Model,
	Modify,
	Role,
	Utils,
} from "@fookiejs/core"
import { verifyGoogleAccessToken } from "./google/google.ts"
import { v4 } from "uuid"
type IAccount = typeof Model & {
	new (): Model & {
		iss: string
		sub: string
		email: string
		name: string
		picture: string
	}
}
export const ACCOUNT = Symbol("account")
export interface AuthReturn {
	Account: IAccount
	loggedIn: Role<Model, Method>
}
export function initAuth(
	database: Database,
): AuthReturn {
	const loggedIn = Role.create({
		key: "loggedIn",
		async execute(payload: any) {
			const loggedIn = payload.state[ACCOUNT] instanceof Account
			if (!loggedIn) {
				throw FookieError.create({
					message: `User is not logged in.`,
					status: 401,
					code: "NOT_LOGGED_IN",
				})
			}
			return true
		},
	})
	const belongsToUser = Modify.create({
		key: "belongsToUser",
		async execute(payload) {
			if (payload.state.acceptedRoles.includes(loggedIn)) {
				payload.query.filter["id"] = { equals: payload.state[ACCOUNT].id }
			}
		},
	})
	const anonymizeEmail = Effect.create<Account, Method.DELETE>({
		key: "anonymizeEmail",
		async execute(_payload, response) {
			await Account.update({ filter: { id: { in: response } } }, { email: `${v4()}@anonymized.anonymized` }, {
				token: Config.SYSTEM_TOKEN,
			})
		},
	})
	@Model.Decorator({
		database,
		binds: {
			[Method.CREATE]: {
				role: [defaults.role.system],
			},
			[Method.READ]: {
				role: [defaults.role.system, loggedIn],
				modify: [belongsToUser],
			},
			[Method.UPDATE]: {
				role: [defaults.role.system, loggedIn],
				modify: [belongsToUser],
			},
			[Method.DELETE]: {
				role: [defaults.role.system, loggedIn],
				modify: [belongsToUser],
				effect: [anonymizeEmail],
			},
		},
	})
	class Account extends Model {
		@Field.Decorator({ type: defaults.types[TypeStandartization.String] })
		iss!: string
		@Field.Decorator({ type: defaults.types[TypeStandartization.String] })
		sub!: string
		@Field.Decorator({ type: defaults.types[TypeStandartization.String] })
		email!: string
		@Field.Decorator({ type: defaults.types[TypeStandartization.String] })
		name!: string
		@Field.Decorator({ type: defaults.types[TypeStandartization.String] })
		picture!: string
	}
	const parseToken = Modify.create({
		key: "parseToken",
		execute: async function (payload) {
			if (!Utils.isString(payload.options.token)) {
				return
			}
			let token = `${payload.options.token as string}`
			if (token.startsWith("Bearer ")) {
				token = token.replace("Bearer ", "")
			}
			let userData = null
			if (token.startsWith("google_")) {
				token = token.slice(7)
				userData = await verifyGoogleAccessToken(token)
			}
			if (userData === null) {
				return
			}
			const userExists = await Account.read({ filter: { email: { equals: userData.email } } }, {
				token: Config.SYSTEM_TOKEN,
			})
			if (userExists.length === 0) {
				const account = await Account.create({
					iss: userData.iss,
					sub: userData.sub,
					email: userData.email,
					name: userData.name,
					picture: userData.picture,
				}, {
					token: Config.SYSTEM_TOKEN,
				})
				payload.state[ACCOUNT] = account
			} else {
				payload.state[ACCOUNT] = userExists[0]
			}
		},
	})
	globalPreModifies.push(parseToken)
	return { loggedIn, Account }
}
export function initBelongsToUser(field: string) {
	return Modify.create({
		key: "belongsToUser",
		async execute(payload) {
			payload.query.filter[field] = { equals: payload.state[ACCOUNT].id }
		},
	})
}
