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
    validators?: [(value: any) => Promise<boolean>];
    onlyClient?: boolean;
    onlyServer?: boolean;
    relation?: typeof Model;
    read?: LifecycleFunction[];
    write?: LifecycleFunction[];
    cascadeDelete?: boolean;
    reactiveDelete?: boolean;
    minimum?: number;
    maximum?: number;
    minimumSize?: number;
    maximumSize?: number;
    reactives?: {
        to: string;
        from: string;
        compute: Function;
    }[];

    static Decorator = function (field: Field) {
        return (target: any, property: any) => {
            const metadata =
                Reflect.getMetadata("schema", target.constructor) ||
                fillSchema({
                    id: {
                        type: text,
                    },
                });

            metadata[property] = fillSchema(field);

            Reflect.defineMetadata("schema", metadata, target.constructor);
        };
    };
}
