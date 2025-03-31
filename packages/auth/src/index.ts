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

import { verifyGoogleAccessToken } from "./google/google.ts"

export const ACCOUNT = Symbol("account")

export interface AuthReturn {
	Account: typeof Model & {
		new (): Model & {
			iss: string
			sub: string
			email: string
			name: string
			picture: string
		}
	}
	loggedIn: Role<Model, Method>
}

export function initAuth(
	database: Database,
): AuthReturn {
	@Model.Decorator({
		database,
		binds: {
			[Method.CREATE]: {
				role: [defaults.role.system],
			},
			[Method.READ]: {
				role: [defaults.role.system, loggedIn],
			},
			[Method.UPDATE]: {
				role: [defaults.role.system],
			},
			[Method.DELETE]: {
				role: [defaults.role.system, loggedIn],
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
	return { loggedIn, Account }
}
