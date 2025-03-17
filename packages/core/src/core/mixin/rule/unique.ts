import * as lodash from "https://raw.githubusercontent.com/lodash/lodash/4.17.21-es/lodash.js";
import { Rule } from "../../lifecycle-function.ts";
import { Config } from "../../config.ts";
import { defaults } from "../../../defaults/index.ts";

export default Rule.create({
  key: "unique",
  execute: async function (payload) {
    const trash_old = payload.method === "create" ? 0 : 1;
    const fields = lodash.keys(payload.body);
    for (const field of fields) {
      if (
        (payload.model.schema() as Record<string, any>)[
          field
        ].features.includes(defaults.feature.unique)
      ) {
        const res = await payload.model.read(
          {
            filter: {
              [field]: { equals: (payload.body as Record<string, any>)[field] },
            },
          },
          { sub: Config.SYSTEM_TOKEN }
        );

        if (Array.isArray(res) && res.length > trash_old) {
          return false;
        }
      }
    }
    return true;
  },
});
