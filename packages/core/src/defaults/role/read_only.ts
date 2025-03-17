import { Role } from "../../core/lifecycle-function.ts"
import { Method } from "../../core/method.ts"

export const readOnly = Role.create({
  key: "read_only",
  execute: async function (payload) {
    return payload.method === Method.READ
  },
})
