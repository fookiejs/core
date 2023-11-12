export type Method = "create" | "read" | "update" | "delete" | "count" | "test" | "sum"
export type LifecycleStep = "pre_rule" | "modify" | "role" | "rule" | "filter" | "effect"

export interface LifecycleFunction<E, M extends Method> {
    (payload: PayloadInterface<E, M>, state: StateInterface): Promise<boolean> | Promise<void>
}

export interface TypeInterface {
    name: string
    controller: (val: any) => boolean
    mock: any
}

export interface ModelInterface {
    name: string
    database: DatabaseInterface
    schema: {
        [key: string]: FieldInterface
    }
    methods: {
        [key in Method]?: LifecycleFunction<unknown, Method>
    }
    bind: {
        [ls in Method]?: {
            pre_rule?: LifecycleFunction<unknown, Method>[]
            modify?: LifecycleFunction<unknown, Method>[]
            role?: LifecycleFunction<unknown, Method>[]
            rule?: LifecycleFunction<unknown, Method>[]
            filter?: LifecycleFunction<unknown, Method>[]
            effect?: LifecycleFunction<unknown, Method>[]
            accept?: {
                [key: string]: {
                    modify?: LifecycleFunction<unknown, Method>[]
                    rule?: LifecycleFunction<unknown, Method>[]
                }
            }
            reject?: {
                [key: string]: {
                    modify?: LifecycleFunction<unknown, any>[]
                    rule?: LifecycleFunction<unknown, Method>[]
                }
            }
        }
    }
    mixins: MixinInterface[]
}

export interface FieldInterface {
    type?: TypeInterface
    required?: boolean
    unique?: boolean
    default?: any
    unique_group?: string[]
    only_client?: boolean
    only_server?: boolean
    relation?: ModelInterface
    read?: LifecycleFunction<unknown, Method>[]
    write?: LifecycleFunction<unknown, Method>[]
    cascade_delete?: boolean
    reactive_delete?: boolean
    minimum?: number
    maximum?: number
    minimum_size?: number
    maximum_size?: number
    reactives?: {
        to: string
        from: string
        compute: Function
    }[]
    validators?: [(value: any) => Promise<boolean>]
}

export interface FilterFieldInterface {
    lte: any
    lt: any
    gte: any
    gt: any
    eq: any
    not: any
    in: any[]
    not_in: any[]
    inc: any
}

export interface DatabaseInterface {
    pk: string
    pk_type: TypeInterface
    connect: Function
    disconnect: Function
    modify: (model: Partial<ModelInterface>) => void
}

export type BodyType<E, M extends Method> = M extends "create"
    ? E
    : M extends "read"
    ? never
    : M extends "update"
    ? Partial<E>
    : M extends "delete"
    ? never
    : M extends "count"
    ? never
    : M extends "sum"
    ? never
    : M extends "test"
    ? any
    : unknown

type DataType<E, M extends Method> = M extends "create"
    ? E
    : M extends "read"
    ? E[]
    : M extends "update"
    ? boolean
    : M extends "delete"
    ? boolean
    : M extends "count"
    ? number
    : M extends "sum"
    ? number
    : M extends "test"
    ? ResponseInterface<E, M>
    : unknown

export interface PayloadInterface<E, M extends Method> {
    token?: string
    model: ModelInterface
    method: Method
    query?: {
        filter?: {
            [key in keyof E | string]: FilterFieldInterface
        }
        attributes?: string[]
        limit?: number
        offset?: number
    }
    body?: BodyType<E, M>
    options?: {
        field?: string
        method?: Method
        simplified?: boolean
        drop?: number
    }
    response?: ResponseInterface<E, M>
}

export interface ResponseInterface<E, M extends Method> {
    status: boolean
    data: DataType<E, M>
    error: string
    validation_error: {
        [key: string]: string[]
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
    todo: PayloadInterface<unknown, Method>[]
    [key: string]: any
}

export interface MixinInterface {
    schema?: {
        [key: string]: FieldInterface
    }
    bind?: {
        [ls in Method]?: {
            pre_rule?: LifecycleFunction<unknown, Method>[]
            modify?: LifecycleFunction<unknown, Method>[]
            role?: LifecycleFunction<unknown, Method>[]
            rule?: LifecycleFunction<unknown, Method>[]
            filter?: LifecycleFunction<unknown, Method>[]
            effect?: LifecycleFunction<unknown, Method>[]
            accept?: {
                [key: string]: {
                    modify?: LifecycleFunction<unknown, Method>[]
                    rule?: LifecycleFunction<unknown, Method>[]
                }
            }
            reject?: {
                [key: string]: {
                    modify?: LifecycleFunction<unknown, Method>[]
                    rule?: LifecycleFunction<unknown, Method>[]
                }
            }
        }
    }
}
