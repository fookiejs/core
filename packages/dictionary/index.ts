import { DatabaseInterface, LifecycleFunction, Method, MixinInterface, ModelInterface, TypeInterface } from "../../types"

export const Model: { [name: string]: ModelInterface } = {}
export const Database: { [name: string]: DatabaseInterface } = {}
export const Mixin: { [name: string]: MixinInterface } = {}
export const Type: { [name: string]: TypeInterface } = {}
export const Lifecycle: { [name: string]: LifecycleFunction<any, any> } = {}
