import { BaseClass } from "./base-class.ts";
import { Model } from "./model/model.ts";
import { Payload } from "./payload.ts";

export class LifecycleFunction<M extends typeof Model, R> extends BaseClass {
    key: string;
    execute: (payload: Payload<M, R>) => unknown;
}
