import { Model, BaseClass, ModelType, QueryType } from "../exports.ts";
import { Payload } from "./payload.ts";
import { SchemaType } from "./schema.ts";

export type ModifyResponse<T extends typeof Model> = {
    create: (payload: Payload<T, T>) => Promise<T>;
    read: (payload: Payload<T, T[]>) => Promise<T[]>;
    update: (payload: Payload<T, boolean>) => Promise<boolean>;
    del: (payload: Payload<T, boolean>) => Promise<boolean>;
    sum: (payload: Payload<T, number>) => Promise<number>;
    count: (payload: Payload<T, number>) => Promise<number>;
};

export class Database extends BaseClass {
    modify: <T extends typeof Model>(model: ModelType, schema: SchemaType<T>) => ModifyResponse<T>;
    connect: () => Promise<void>;
    disconnect: () => Promise<void>;
}
