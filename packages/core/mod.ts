import "reflect-metadata"
import { v4 } from "uuid"
export * from "./src/config/config.ts"
export * from "./src/error/error.ts"
export * from "./src/base-class/base-class.ts"
export * from "./src/database/database.ts"
export * from "./src/field/field.ts"
export * from "./src/lifecycle-function/lifecycle-function.ts"
export * from "./src/lifecycle/lifecycle.ts"
export * from "./src/method/method.ts"
export * from "./src/model/model.ts"
export * from "./src/type/type.ts"
export * from "./src/payload/payload.ts"
export * from "./src/mixin/index.ts"
export * from "./src/defaults/index.ts"
export * from "./src/utils/util.ts"
export * from "./src/otel/index.ts"
export * from "./src/type/type-matcher.ts"
export const fookieInstanceId: string = v4()
