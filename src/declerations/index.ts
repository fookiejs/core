type Method = "create" | "read"| "update" | "delete" | "count" | "test"
type Lifecycle = "preRule" | "modify"| "role"| "rule"| "filter"| "effect"

interface ModelInterface{
    name:string
    database:DatabaseInterface,
    schema:{
        [key:string]:FieldInterface | string | number
    },
    bind:{
        [ls in Method]:{
            [ls in Lifecycle]:LifecycleFunctionInterface[]
        }
    },
    mixins:MixinInterface[]
}
interface FieldInterface{
    type:TypeInterface
    required: boolean
    unique: boolean
    unique_group: string[]
    only_client:boolean
    only_server: boolean
}

interface FilterFieldInterface{
    lte:number
    lt:number
    gte:number
    gt:number
    eq:number | string
    not:number | string
    or: string[] | number[]
    inc: string | number
}

interface DatabaseInterface{
    pk:string
    types: TypeInterface[]
    connect: Function
    disconnect: Function
    modify: (model:ModelInterface)=>Promise<void>
}

interface LifecycleFunctionInterface{
    name:string
    function: (payload:PayloadInterface, state:StateInterface)=> Promise<boolean> | Promise<void>
}

interface PayloadInterface{
    token:string
    model:ModelInterface
    method: Method
    query:{
        filter:{
            [key:string]:FilterFieldInterface | string | number
        },
        attributes: string[]
        limit: number
        offset: number
    },
    body: object
    options:{
        method?:string
        simplified: boolean
    }

}

interface StateInterface{
    metrics:{
        start: number
        end: number
        lifecycle:{
            name:string
            ms:number
        }
    }
}

interface TypeInterface{
    controller: (v:any)=>boolean
}

interface MixinInterface{
    schema:{
        [key:string]:FieldInterface | string | number
    },
    bind:{
        [ls in Method]:{
            [ls in Lifecycle]:LifecycleFunctionInterface[]
        }
    },
}


