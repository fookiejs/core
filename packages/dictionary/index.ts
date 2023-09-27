import {
    DatabaseInterface,
    LifecycleFunction,
    MixinInterface,
    ModelInterface,
    TypeInterface,
    SelectionInterface,
} from "../../types"

export const Model: { [name: string]: ModelInterface } = {}
export const Database: { [name: string]: DatabaseInterface } = {}
export const Mixin: { [name: string]: MixinInterface } = {}
export const Role: { [name: string]: LifecycleFunction } = {}
export const Selection: { [name: string]: SelectionInterface } = {}
export const Lifecycle: { [name: string]: LifecycleFunction } = {}
export const Type: { [name: string]: TypeInterface } = {}
