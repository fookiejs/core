import * as lodash from "lodash";
import { LifecycleFunction } from "../../../lifecycle-function";

export default LifecycleFunction.new({
    key: "unique_group",
    execute: async function (payload) {
        const fields = lodash.keys(payload.body);
        let groups = [];
        for (const field of fields) {
            if (payload.schema[field].unique_group) {
                groups = lodash.uniq(groups.concat(payload.schema[field].unique_group));
            }
        }

        for (const group of groups) {
            const filter = {};
            for (const field of lodash.keys(payload.schema)) {
                if (
                    payload.schema[field].unique_group &&
                    payload.schema[field].unique_group.includes(group) &&
                    payload.body[field]
                ) {
                    filter[field] = { equals: payload.body[field] };
                }
            }

            const res = await run({
                token: process.env.SYSTEM_TOKEN,
                model: payload.model,
                method: Count,
                query: {
                    filter,
                },
            });
            return res.data == 0;
        }

        return true;
    },
});
