import * as lodash from "lodash";
import { text } from "../../defaults/type/text.ts";
import { LifecycleFunction } from "../lifecycle-function.ts";
import { Model } from "../model/model.ts";
import { Type } from "../type.ts";
import { fillSchema } from "./utils/fill-schema.ts";

export class Field {
    required?: boolean;
    type?: Type;
    unique?: boolean;
    uniqueGroup?: string[];
    default?: unknown;
    validators?: [(value: any) => boolean | string];
    relation?: typeof Model;
    read?: LifecycleFunction<any, any>[];
    write?: LifecycleFunction<any, any>[];
    cascadeDelete?: boolean;

    static Decorator = function (field: Field) {
        return (target: any, property: any) => {
            const metadata = Reflect.getMetadata("schema", target.constructor) || {};

            if (!lodash.has(metadata, "id")) {
                metadata["id"] = fillSchema({
                    type: text,
                });
            }

            metadata[property] = fillSchema(field);

            Reflect.defineMetadata("schema", metadata, target.constructor);
        };
    };
}
