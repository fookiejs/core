import { Rule } from "../../lifecycle-function.ts";

export default Rule.create({
  key: "db_connect",
  execute: async function (payload) {
    await payload.model.database().connect();
    return true;
  },
});
