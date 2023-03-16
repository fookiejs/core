type Method = "create" | "read" | "update" | "delete" | "count" | "test"
type Lifecycle = "preRule" | "modify" | "role" | "rule" | "filter" | "effect"
type LifecycleFunction = (payload: PayloadInterface, state: StateInterface) => Promise<boolean> | Promise<void>
type Type = (v: any) => (v: any) => boolean

interface ModelInterface {
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

interface FieldInterface {
    type: Type
    required?: boolean
    unique?: boolean
    unique_group?: string[]
    only_client?: boolean
    only_server?: boolean
    relation?: ModelInterface
    read?: Lifecycle[]
}

interface FilterFieldInterface {
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

interface DatabaseInterface {
    pk: string
    types: Type[]
    connect: Function
    disconnect: Function
    modify: (model: ModelInterface) => void
}

interface PayloadInterface {
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

interface StateInterface {
    metrics: {
        start: number
        end?: number
        lifecycle: {
            name: string
            ms: number
        }[]
    }
}

interface MixinInterface {
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
