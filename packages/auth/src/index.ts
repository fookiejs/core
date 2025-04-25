import {
	Config,
	Database,
	defaults,
	Effect,
	Field,
	Filter,
	globalPreModifies,
	Method,
	Model,
	Modify,
	Payload,
	Role,
	TypeStandartization,
	Utils,
} from "@fookiejs/core"
import { verifyGoogleAccessToken } from "./google/google.ts"
import { v4 } from "uuid"

import * as crypto from "node:crypto"

type IAccount = typeof Model & {
	new (): Model & {
		iss: string
		sub: string
		email: string
		name: string
		picture: string
	}
}

type IApiKey = typeof Model & {
	new (): Model & {
		key?: string
		name: string
		accountId?: string
	}
}

export const ACCOUNT = Symbol("ACCOUNT")

export interface AuthReturn {
	Account: IAccount
	ApiKey: IApiKey
	loggedIn: Role<Model, Method>
}

export function initAuth(database: Database): AuthReturn {
	const loggedIn = Role.create({
		key: "loggedIn",
		async execute(payload: Payload<Model, Method>) {
			return payload.state[ACCOUNT] instanceof Account
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
				role: [defaults.role.system],
				modify: [],
			},
			[Method.DELETE]: {
				role: [defaults.role.system, loggedIn],
				modify: [belongsToUser],
				effect: [anonymizeEmail],
			},
		},
	})
	class Account extends Model {
		@Field.Decorator({ type: TypeStandartization.String })
		iss!: string

		@Field.Decorator({ type: TypeStandartization.String })
		sub!: string

		@Field.Decorator({ type: TypeStandartization.String })
		email!: string

		@Field.Decorator({ type: TypeStandartization.String })
		name!: string

		@Field.Decorator({ type: TypeStandartization.String })
		picture!: string
	}

	const belongsToApiKeyOwner = Modify.create<ApiKey, Method.READ | Method.CREATE | Method.DELETE>({
		key: "belongsToApiKeyOwner",
		async execute(payload: Payload<ApiKey, Method.READ | Method.CREATE | Method.DELETE>) {
			if (payload.state.acceptedRoles.includes(loggedIn)) {
				if (payload.method === Method.READ || payload.method === Method.DELETE) {
					payload.query.filter.accountId = { equals: payload.state[ACCOUNT]?.id }
				}

				if (payload.method === Method.CREATE) {
					payload.body.accountId = payload.state[ACCOUNT]?.id
				}
			}
		},
	})

	const AddRandomKey = Modify.create<ApiKey, Method.CREATE>({
		key: "AddRandomKey",
		async execute(payload) {
			payload.body.key = `${
				[...crypto.randomBytes(32)].map((b) => "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"[b % 62])
					.join("")
			}_${Date.now().toString(36)}`
		},
	})

	const HashApiKey = Effect.create<ApiKey, Method.CREATE>({
		key: "HashApiKey",
		async execute(payload, response) {
			await ApiKey.update({ filter: { id: { equals: response.id } } }, {
				key: crypto.createHash("sha256").update(payload.body.key).digest("hex"),
			}, {
				token: Config.SYSTEM_TOKEN,
			})
		},
	})

	const UglifyApiKey = Filter.create<ApiKey, Method.READ>({
		key: "UglifyApiKey",
		async execute(_, response) {
			response.map((apiKey) => {
				apiKey.key = "****************************"
			})
		},
	})

	@Model.Decorator({
		database,
		binds: {
			[Method.CREATE]: {
				role: [defaults.role.system, loggedIn],
				modify: [belongsToApiKeyOwner, AddRandomKey],
				effect: [HashApiKey],
			},
			[Method.READ]: {
				role: [defaults.role.system, loggedIn],
				modify: [belongsToApiKeyOwner],
				filter: [UglifyApiKey],
			},
			[Method.DELETE]: {
				role: [defaults.role.system, loggedIn],
				modify: [belongsToApiKeyOwner],
			},
		},
	})
	class ApiKey extends Model {
		@Field.Decorator({
			type: TypeStandartization.String,
			features: [defaults.feature.required, defaults.feature.unique],
		})
		key?: string

		@Field.Decorator({ type: TypeStandartization.String })
		name!: string

		@Field.Decorator({ relation: Account, features: [defaults.feature.required] })
		accountId?: string
	}

	async function authenticateWithGoogle(token: string): Promise<InstanceType<IAccount> | null> {
		const userData = await verifyGoogleAccessToken(token)
		if (!userData) return null

		const userExists = await Account.read({ filter: { email: { equals: userData.email } } }, {
			token: Config.SYSTEM_TOKEN,
		})

		if (userExists.length === 0) {
			return await Account.create({
				iss: userData.iss,
				sub: userData.sub,
				email: userData.email,
				name: userData.name,
				picture: userData.picture,
			}, {
				token: Config.SYSTEM_TOKEN,
			})
		}

		return userExists[0]
	}

	async function authenticateWithApiKey(token: string): Promise<InstanceType<IAccount> | null> {
		const hash = crypto.createHash("sha256").update(token).digest("hex")
		const apiKeys = await ApiKey.read({ filter: { key: { equals: hash } } }, { token: Config.SYSTEM_TOKEN })

		if (apiKeys.length === 0) return null

		const accounts = await Account.read({ filter: { id: { equals: apiKeys[0].accountId } } }, {
			token: Config.SYSTEM_TOKEN,
		})

		return accounts.length > 0 ? accounts[0] : null
	}

	const parseToken = Modify.create({
		key: "parseToken",
		execute: async function (payload: Payload<Model, Method>) {
			if (!Utils.isString(payload.options.token)) return

			let token = payload.options.token as string
			if (token.startsWith("Bearer ")) {
				token = token.replace("Bearer ", "")
			}

			let account: InstanceType<IAccount> | null = null

			if (token.startsWith("google_")) {
				account = await authenticateWithGoogle(token.slice(7))
			} else if (token.startsWith("apikey_")) {
				account = await authenticateWithApiKey(token.slice(7))
			}

			if (account) {
				payload.state[ACCOUNT] = account
			}
		},
	})

	globalPreModifies.push(parseToken)

	return { loggedIn, Account, ApiKey }
}

export function initBelongsToUser(field: string) {
	return Modify.create({
		key: "belongsToUser",
		async execute(payload) {
			payload.query.filter[field] = { equals: payload.state[ACCOUNT].id }
		},
	})
}
