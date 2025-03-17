import { Rule } from "../../lifecycle-function.ts";
import { methods } from "../../method.ts";

export default Rule.create({
  key: "has_method",
  execute: async function (payload) {
    return methods.includes(payload.method);
  },
});
