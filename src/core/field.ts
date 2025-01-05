import { BaseClass } from "./base-class"
import { Model } from "./model"
import { Type } from "./type"

export class Field extends BaseClass {
    type: Type
    features: symbol[]
    relation: typeof Model
}
