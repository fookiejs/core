import * as lodash from "lodash";
import { LifecycleFunction } from "../../../lifecycle-function";

export default LifecycleFunction.new({
    key: "reactive_prepare",
    execute: async function (payload) {
        /* 
        const entities = await run<any, "read">({
            token: process.env.SYSTEM_TOKEN,
            model: payload.model,
            method: Read,
            query: payload.query,
        });

        const schema = payload.model.schema;
        const has = lodash.has;
        for (const field in schema) {
            if (has(schema[field], "reactive_delete") && !!schema[field].reactive_delete) {
                for (const entity of entities.data) {
                    state.todo.push({
                        token: process.env.SYSTEM_TOKEN,
                        model: schema[field].relation,
                        method: Delete,
                        query: {
                            filter: {
                                pk: { equals: entity[field] },
                            },
                        },
                    });
                }
            }
        }
        */
    },
});
