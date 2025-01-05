import { Model } from "./model"
import { Type } from "./type"

export class Field {
    type: Type
    features: symbol[]
    relation: typeof Model
}
