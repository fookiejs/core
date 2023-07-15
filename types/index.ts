export type Method = "create" | "read" | "update" | "delete" | "count" | "test" | "sum"
export type Lifecycle = "preRule" | "modify" | "role" | "rule" | "filter" | "effect"
export interface LifecycleFunction {
    (payload: PayloadInterface, state: StateInterface): Promise<boolean> | Promise<void>
}
export interface Type {
    (val: any): boolean
}

export interface Selection {
    (payload: PayloadInterface, target_model: ModelInterface): Promise<any>
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
        field?: string
        method?: ClassMethodDecoratorContext
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

export interface Fookie {
    Core: CorePackage
    Database: {
        Store: DatabaseInterface
    }
    Decorator: {
        Model(_model: Partial<ModelInterface>): (target: any) => void
        Field(field: Partial<FieldInterface>): (target: any, key: any) => void
    }
    Method: MethodPackage
    Mixin: {
        After: MixinInterface
        Before: MixinInterface
    }
    Role: {
        everybody: LifecycleFunction
        nobody: LifecycleFunction
        system: LifecycleFunction
    }
    Selection: {
        Random: Selection
    }
    Type: {
        Text: Type
        Float: Type
        Integer: Type
        Array: Type
        Boolean: Type
        Buffer: Type
        Plain: Type
        Char: Type
        Function: Type
        Timestamp: Type
        StringArray: Type
        FloatArray: Type
        IntegerArray: Type
    }
}

interface CorePackage {
    models: ModelInterface[]
    model: (model: Partial<ModelInterface>) => Promise<ModelInterface>
    lifecycle: (lifecycle: LifecycleFunction) => LifecycleFunction
    run: (
        payload:
            | PayloadInterface
            | (Omit<PayloadInterface, "model"> & {
                  model: Function
              })
            | (Omit<PayloadInterface, "model"> & {
                  model: string
              })
    ) => Promise<any>
    mixin: (mixin: MixinInterface) => MixinInterface
    database: (database: DatabaseInterface) => DatabaseInterface
    type: (type: Type) => Type
}

export interface MethodPackage {
    Create: Method
    Read: Method
    Update: Method
    Delete: Method
    Count: Method
    Test: Method
    Sum: Method
    Methods: Method[]
}
