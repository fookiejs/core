import { Type } from "@fookie/type"
import { ModelInterface } from "@fookie/core"

export interface DatabaseInterface {
    pk: string
    types: Type[]
    pk_type: Type
    connect: Function
    disconnect: Function
    modify: (model: ModelInterface) => void
}
