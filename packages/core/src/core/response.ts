import type { Method } from "./method.ts"

export type CreateResponse<T> = T
export type ReadResponse<T> = T[]
export type UpdateResponse = string[]
export type DeleteResponse = string[]

export type MethodResponse<T> = {
	[Method.CREATE]: CreateResponse<T>
	[Method.READ]: ReadResponse<T>
	[Method.UPDATE]: UpdateResponse
	[Method.DELETE]: DeleteResponse
}

export type FookieResponse<T> =
	| CreateResponse<T>
	| ReadResponse<T>
	| UpdateResponse
	| DeleteResponse
