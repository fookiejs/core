import * as lodash from "lodash";
import { LifecycleFunction } from "../../../lifecycle-function";

export default LifecycleFunction.new({
    key: "reactives",
    execute: async function (payload) {
        const schema = payload.schema;
        const fields = lodash.keys(schema);

        for (const field of fields) {
            if (lodash.has(schema[field], "reactives")) {
                for (const reactive of schema[field].reactives) {
                    const entities = await run<any, "read">({
                        token: process.env.SYSTEM_TOKEN,
                        model: payload.model,
                        method: Read,
                        query: payload.query,
                    });
                    for (const entity of entities.data) {
                        if (entity[field]) {
                            await run({
                                token: process.env.SYSTEM_TOKEN,
                                model: schema[field].relation,
                                method: Update,
                                query: {
                                    filter: {
                                        pk: { equals: entity[field] },
                                    },
                                },
                                body: {
                                    [reactive.to]: reactive.compute(payload.body[reactive.from]),
                                },
                            });
                        }
                    }
                }
            }
        }
    },
});
