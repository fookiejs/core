export type Method = "create" | "read" | "update" | "delete" | "count" | "test" | "sum"
export type LifecycleStep = "pre_rule" | "modify" | "role" | "rule" | "filter" | "effect"
export interface LifecycleFunction {
    (payload: PayloadInterface, state: StateInterface): Promise<boolean> | Promise<void>
}
export interface TypeInterface {
    (val: any): boolean
}

export interface SelectionInterface {
    (payload: PayloadInterface, target_model: ModelInterface): Promise<any>
}

export interface ModelInterface {
    name: string
    database: DatabaseInterface
    schema: {
        [key: string]: FieldInterface
    }
    methods: {
        [key in Method]?: LifecycleFunction
    }
    bind: {
        [ls in Method]?: {
            pre_rule?: LifecycleFunction[]
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
    type?: TypeInterface
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
    selection?: SelectionInterface
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
        field?: string
        method?: Method
        simplified?: boolean
        drop?: number
    }
    response?: ResponseInterface
}

export interface ResponseInterface {
    status: boolean
    data: any
    error: string
    validation_error: {
        [key: string]: string[]
    }
}

export interface PayloadInterfaceWithoutModelAndMethod extends Omit<PayloadInterface, "model" | "method"> {}

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
    [key: string]: any
}

export interface MixinInterface {
    schema?: {
        [key: string]: FieldInterface
    }
    bind?: {
        [ls in Method]?: {
            pre_rule?: LifecycleFunction[]
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
