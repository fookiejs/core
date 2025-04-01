import {
	Config,
	Database,
	defaults,
	Effect,
	Field,
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
			return payload.state[ACCOUNT] instanceof Account
		},
	})

	const belongsToUser = Modify.create({
		key: "belongsToUser",
		async execute(payload) {
			payload.query.filter["id"] = { equals: payload.state[ACCOUNT].id }
		},
	})

	const anonymizeEmailSymbol = Symbol("anonymizeEmail")

	const anonymizeEmail = Effect.create<Account, Method>({
		key: "anonymizeEmail",
		async execute(payload) {
			const accounts = await payload.state[anonymizeEmailSymbol]

			const ids = accounts.map((account) => account.id)
			await Account.update({ filter: { id: { in: ids } } }, { email: `${v4()}@anonymized.anonymized` }, {
				token: Config.SYSTEM_TOKEN,
			})
		},
	})

	const findAnonymizedEmail = Modify.create<Account, Method>({
		key: "findAnonymizedEmail",
		async execute(payload) {
			const accounts = Account.read(payload.query, { token: Config.SYSTEM_TOKEN })
			payload.state[anonymizeEmailSymbol] = accounts
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
				accepts: [[loggedIn, {
					modify: [belongsToUser],
				}]],
			},
			[Method.UPDATE]: {
				role: [defaults.role.system, loggedIn],
				accepts: [[loggedIn, {
					modify: [belongsToUser],
				}]],
			},
			[Method.DELETE]: {
				role: [defaults.role.system, loggedIn],
				modify: [findAnonymizedEmail],
				effect: [anonymizeEmail],
				accepts: [[loggedIn, {
					modify: [belongsToUser],
				}]],
			},
		},
	})
	class Account extends Model {
		@Field.Decorator({ type: defaults.type.text })
		iss!: string

		@Field.Decorator({ type: defaults.type.text })
		sub!: string

		@Field.Decorator({ type: defaults.type.text })
		email!: string

		@Field.Decorator({ type: defaults.type.text })
		name!: string

		@Field.Decorator({ type: defaults.type.text })
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
