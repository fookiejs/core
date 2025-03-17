import * as lodash from "https://raw.githubusercontent.com/lodash/lodash/4.17.21-es/lodash.js";
import { Modify } from "../../lifecycle-function.ts";

export default Modify.create({
  key: "filter_fields",
  execute: async function (payload) {
    for (const key of payload.query.attributes || []) {
      const field = (payload.model.schema() as Record<string, any>)[key];

      let show = true;

      for (const role of field.read || []) {
        const res = await role.execute(payload);

        show = show && !!res;
      }

      if (!show) {
        payload.query.attributes = lodash.pull(payload.query.attributes, key);
      }
    }
  },
});
