import * as lodash from "lodash";
import { LifecycleFunction } from "../../../lifecycle-function";
import { models } from "../../../model/model";

export default LifecycleFunction.new({
    key: "cascade_prepare",
    execute: async function (payload) {
        const entities = await payload.modelClass.read(payload.query);

        const cascade_delete_ids = entities.map(function (e) {
            return e.id;
        });

        for (const model of models) {
            for (const field in model.schema) {
                if (
                    model.schema[field].cascadeDelete &&
                    model.schema[field].relation &&
                    model.schema[field].relation === payload.modelClass
                ) {
                    const fn = async function () {
                        await model.modelClass.delete({
                            filter: {
                                id: cascade_delete_ids,
                            },
                        });
                    };

                    payload.state.todo.push(fn);
                }
            }
        }
    },
});
