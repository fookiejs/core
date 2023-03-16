export type Method = "create" | "read" | "update" | "delete" | "count" | "test"
export type Lifecycle = "preRule" | "modify" | "role" | "rule" | "filter" | "effect"
export type LifecycleFunction = (payload: PayloadInterface, state: StateInterface) => Promise<boolean> | Promise<void>
export type Type = (v: any) => (v: any) => boolean

export interface ModelInterface {
    name: string
    database: DatabaseInterface
    schema: {
        [key: string]: FieldInterface
    }
    methods: {
        [key in Method]: (payload: PayloadInterface, state: StateInterface) => unknown
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
                    modify: LifecycleFunction[]
                    rule: LifecycleFunction[]
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
    type: Type
    required?: boolean
    unique?: boolean
    unique_group?: string[]
    only_client?: boolean
    only_server?: boolean
    relation?: ModelInterface
    read?: Lifecycle[]
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

export interface DatabaseInterface {
    pk: string
    types: Type[]
    connect: Function
    disconnect: Function
    modify: (model: ModelInterface) => void
}

export interface PayloadInterface {
    token?: string
    model: ModelInterface
    method: Method
    query?: {
        filter: {
            [key: string]: FilterFieldInterface | string | number
        }
        attributes: string[]
        limit: number
        offset: number
    }
    body?: any
    options?: {
        method?: string
        simplified: boolean
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
        end: number
        lifecycle: {
            name: string
            ms: number
        }[]
    }
}

export interface MixinInterface {
    schema?: {
        [key: string]: FieldInterface | string | number
    }
    bind?: {
        [ls in Method]: {
            preRule?: LifecycleFunction[]
            modify?: LifecycleFunction[]
            role?: LifecycleFunction[]
            rule?: LifecycleFunction[]
            filter?: LifecycleFunction[]
            effect?: LifecycleFunction[]
            accept?: {
                [key: string]: {
                    modify: LifecycleFunction[]
                    rule: LifecycleFunction[]
                }
            }
            reject?: {
                [key: string]: {
                    modify: LifecycleFunction[]
                    rule: LifecycleFunction[]
                }
            }
        }
    }
}
