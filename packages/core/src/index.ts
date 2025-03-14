import "reflect-metadata"
import { v4 } from "uuid"

export * from "./core/config"
export * from "./core/error"
export * from "./core/base-class"
export * from "./core/database"
export * from "./core/field/field"
export * from "./core/lifecycle-function"
export * from "./core/lifecycle"
export * from "./core/method"
export * from "./core/model/model"
export * from "./core/type"
export * from "./core/payload"
export * from "./core/mixin"

export * from "./defaults"

export const instanceId = v4()
