export type Method = "create" | "read" | "update" | "delete" | "count" | "test"
export type Lifecycle = "preRule" | "modify" | "role" | "rule" | "filter" | "effect"
export interface LifecycleFunction {
    (payload: PayloadInterface, state: StateInterface): Promise<boolean> | Promise<void>
}
export interface Type {
    (val: any): boolean
}

export interface Selection {
    (model: ModelInterface, field: FieldInterface): Promise<any>
}

export interface Modify {
    (model: Partial<ModelInterface>)
}

export interface ModelInterface {
    name: string
    database: DatabaseInterface
    schema: {
        [key: string]: FieldInterface
    }
    methods?: {
        [key in Method]?: LifecycleFunction
    }
    bind: {
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
    mixins: MixinInterface[]
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
    selection?: Selection
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
    eq: any[]
    not: any[]
    or: any[]
    notor: any[]
    inc: string | number
}

export interface DatabaseInterface {
    pk: string
    types: Type[]
    pk_type: Type
    connect: Function
    disconnect: Function
    modify: Modify
}

export interface PayloadInterface {
    token?: string
    model: ModelInterface
    method: Method
    query?: {
        filter?: {
            [key: string]: FilterFieldInterface | any
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
    todo: PayloadInterface[]
}

export interface MixinInterface {
    schema?: {
        [key: string]: FieldInterface | string | number
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
}
