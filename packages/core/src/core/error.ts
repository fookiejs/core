import { plainToClass } from "class-transformer"
import type { Type } from "./type.ts"

export class FookieError extends Error {
	validationErrors!: {
		[field: string]: string[]
	}
	status?: number

	static create(error: FookieError): FookieError {
		return plainToClass(FookieError, error)
	}
}
