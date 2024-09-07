import { Method } from "./method"

export type CreateResponse<T> = T
export type ReadResponse<T> = T[]
export type UpdateResponse = boolean
export type DeleteResponse = boolean
export type CountResponse = number
export type SumResponse = number

export type MethodResponse<T> = {
    [Method.CREATE]: CreateResponse<T>
    [Method.READ]: ReadResponse<T>
    [Method.UPDATE]: UpdateResponse
    [Method.DELETE]: DeleteResponse
    [Method.COUNT]: CountResponse
    [Method.SUM]: SumResponse
}

export type FookieResponse<T> =
    | CreateResponse<T>
    | ReadResponse<T>
    | UpdateResponse
    | DeleteResponse
    | CountResponse
    | SumResponse
