import "reflect-metadata"
import { v4 } from "uuid"

export * from "./src/core/config.ts"
export * from "./src/core/error.ts"
export * from "./src/core/base-class.ts"
export * from "./src/core/database.ts"
export * from "./src/core/field/field.ts"
export * from "./src/core/lifecycle-function.ts"
export * from "./src/core/lifecycle.ts"
export * from "./src/core/method.ts"
export * from "./src/core/model/model.ts"
export * from "./src/core/type.ts"
export * from "./src/core/payload.ts"
export * from "./src/core/mixin/index.ts"
export * from "./src/defaults/index.ts"
export * from "./src/utils/util.ts"

export const fookieInstanceId = v4()
