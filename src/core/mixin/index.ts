import { BaseClass } from "../base-class"
import { BindsType } from "../model/model"
export * from "./src/binds/after"
export * from "./src/binds/before"
export * from "./src/binds/global"

export class Mixin extends BaseClass {
    binds: BindsType
}
