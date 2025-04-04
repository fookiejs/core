import { plainToClass } from "class-transformer"

export class FookieError extends Error {
	validationErrors!: {
		[field: string]: string[]
	}
	status?: number

	static create(error: FookieError): FookieError {
		return plainToClass(FookieError, error)
	}
}
