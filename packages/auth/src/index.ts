import {
	Config,
	Database,
	defaults,
	Field,
	globalPreModifies,
	Method,
	Model,
	Modify,
	Role,
	Utils,
} from "@fookiejs/core"

import { system } from "../../core/src/defaults/role/system.ts"
import { verifyGoogleAccessToken } from "./google/google.ts"

export const ACCOUNT = Symbol("account")

export function initAuth(
	database: Database,
) {
	@Model.Decorator({
		database,
		binds: {
			[Method.CREATE]: {
				role: [system],
			},
			[Method.READ]: {
				role: [system],
			},
			[Method.UPDATE]: {
				role: [system],
			},
			[Method.DELETE]: {
				role: [system],
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

	const loggedIn = Role.create({
		key: "loggedIn",

		async execute(payload: any) {
			return payload.state[ACCOUNT] instanceof Account
		},
	})
	return { loggedIn, Account } as {
		Account: typeof Account
		loggedIn: typeof loggedIn
	}
}
