import { FookieError } from "./error.ts"
import * as lodash from "npm:lodash@^4.17.21"
export enum Environment {
	LOCAL = "local",
	TEST = "test",
	DEVELOPMENT = "development",
	PRODUCTION = "production",
}

export class Config {
	private static env: Record<string, string> = {}

	static SYSTEM_TOKEN = Symbol("SYSTEM_TOKEN")

	static get(key: string): string {
		if (!lodash.has(this.env, key)) {
			throw FookieError.create({
				name: "missing_config",
				message: `Environment variable not found`,
				validationErrors: {},
			})
		}
		return this.env[key]
	}

	static set(key: string, value: string): void {
		this.env[key] = value
	}
}
