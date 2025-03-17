import { Role } from "../../core/lifecycle-function";
import { Method } from "../../core/method";

export const readOnly = Role.create({
  key: "read_only",
  execute: async function (payload) {
    return payload.method === Method.READ;
  },
});
