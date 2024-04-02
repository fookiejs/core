import { BaseClass } from "./base-class";
import { LifecycleFunction } from "./lifecycle-function";
import { Method } from "./method";
import { Model, ModelType } from "./model/model";
import { SchemaType } from "./schema";

export class State {
    metrics: {
        start: Date;
        end?: Date | null;
        lifecycle: {
            name: string;
            ms: number;
        }[];
    };
    test?: boolean;
    todo: LifecycleFunction[];
}
