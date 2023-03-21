import { Method } from "@fookie/method"
import { DatabaseInterface } from "@fookie/database"
import { Type } from "@fookie/type"
import { MixinInterface } from "@fookie/mixin"

export type LifecycleFunction = (payload: PayloadInterface, state: StateInterface) => Promise<boolean> | Promise<void>

export interface ModelInterface {
    name?: string
    database?: DatabaseInterface
    schema?: {
        [key: string]: FieldInterface
    }
    methods?: {
        [key in Method]?: (payload: PayloadInterface, state: StateInterface) => unknown
    }
    bind?: {
        [ls in Method]?: {
            preRule?: LifecycleFunction[]
            modify?: LifecycleFunction[]
            role?: LifecycleFunction[]
            rule?: LifecycleFunction[]
            filter?: LifecycleFunction[]
            effect?: LifecycleFunction[]
            accept?: {
                [key: string]: {
                    modify?: LifecycleFunction[]
                    rule?: LifecycleFunction[]
                }
            }
            reject?: {
                [key: string]: {
                    modify?: LifecycleFunction[]
                    rule?: LifecycleFunction[]
                }
            }
        }
    }
    mixins?: MixinInterface[]
}

export interface FieldInterface {
    type?: Type
    required?: boolean
    unique?: boolean
    default?: any
    unique_group?: string[]
    only_client?: boolean
    only_server?: boolean
    relation?: ModelInterface
    read?: LifecycleFunction[]
    write?: LifecycleFunction[]
    cascade_delete?: boolean
    reactive_delete?: boolean
    minimum?: number
    maximum?: number
    minimum_size?: number
    maximum_size?: number
    selection?: (model: ModelInterface, field: FieldInterface) => Promise<any>
    reactives?: {
        to: string
        from: string
        compute: Function
    }[]
}

export interface FilterFieldInterface {
    lte: number
    lt: number
    gte: number
    gt: number
    eq: number | string
    not: number | string
    or: string[] | number[]
    notor: string[] | number[]
    inc: string | number
}

export interface PayloadInterface {
    token?: string
    model: ModelInterface
    method: Method
    query?: {
        filter?: {
            [key: string]: FilterFieldInterface | string | number
        }
        attributes?: string[]
        limit?: number
        offset?: number
    }
    body?: any
    options?: {
        method?: string
        simplified?: boolean
        drop?: number
    }
    response?: {
        status: boolean
        data: any[] | object | number | boolean
        error: string
    }
}

export interface StateInterface {
    metrics: {
        start: number
        end?: number
        lifecycle: {
            name: string
            ms: number
        }[]
    }
    reactive_delete_list: {
        model: ModelInterface
        pk: string | number
    }[]
    cascade_delete_ids: string[]
}
