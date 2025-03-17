import "reflect-metadata"
import { v4 } from "uuid"

export * from "@fookiejs/core/src/core/config.ts"
export * from "@fookiejs/core/src/core/error.ts"
export * from "@fookiejs/core/src/core/base-class.ts"
export * from "@fookiejs/core/src/core/database.ts"
export * from "@fookiejs/core/src/core/field/field.ts"
export * from "@fookiejs/core/src/core/lifecycle-function.ts"
export * from "@fookiejs/core/src/core/lifecycle.ts"
export * from "@fookiejs/core/src/core/method.ts"
export * from "@fookiejs/core/src/core/model/model.ts"
export * from "@fookiejs/core/src/core/type.ts"
export * from "@fookiejs/core/src/core/payload.ts"
export * from "@fookiejs/core/src/core/mixin/index.ts"
export * from "@fookiejs/core/src/defaults/index.ts"

export const fookieInstanceId = v4()
