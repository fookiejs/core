export class FookieError extends Error {
	validationErrors: {
		[field: string]: string[]
	} = {}
	status?: number
	code?: string

	static create(params: {
		message: string
		validationErrors?: { [field: string]: string[] }
		status?: number
		code?: string
		cause?: Error
	}): FookieError {
		const error = new FookieError(params.message, { cause: params.cause })
		error.name = error.constructor.name
		error.validationErrors = params.validationErrors || {}
		error.status = params.status
		error.code = params.code

		if (params.cause) {
			error.stack = `${error.stack}\nCaused by: ${params.cause.stack}`
		}

		Error.captureStackTrace(error, FookieError.create)
		return error
	}
}
