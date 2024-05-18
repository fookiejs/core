import { Model, BaseClass, ModelType } from "../exports"
import { Payload } from "./payload"
import { SchemaType } from "./schema"

export type ModifyResponse<T extends typeof Model> = {
    create: (payload: Payload<T, T>) => Promise<T>
    read: (payload: Payload<T, T[]>) => Promise<T[]>
    update: (payload: Payload<T, boolean>) => Promise<boolean>
    del: (payload: Payload<T, boolean>) => Promise<boolean>
    sum: (payload: Payload<T, number>) => Promise<number>
    count: (payload: Payload<T, number>) => Promise<number>
}

export class Database extends BaseClass {
    modify: <T extends typeof Model>(model: ModelType, schema: SchemaType<T>) => ModifyResponse<T>
    connect: () => Promise<void>
    disconnect: () => Promise<void>
}
