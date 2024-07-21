import { Model, BaseClass, ModelType } from "../exports"
import { Payload } from "./payload"
import { SchemaType } from "./schema"

export class Database extends BaseClass {
    modify: <ModelClass extends Model>(
        model: ModelType,
        schema: SchemaType<ModelClass>,
    ) => {
        create: (payload: Payload<ModelClass, ModelClass>) => Promise<ModelClass>
        read: (payload: Payload<ModelClass, ModelClass[]>) => Promise<ModelClass[]>
        update: (payload: Payload<ModelClass, boolean>) => Promise<boolean>
        del: (payload: Payload<ModelClass, boolean>) => Promise<boolean>
        sum: (payload: Payload<ModelClass, number>) => Promise<number>
        count: (payload: Payload<ModelClass, number>) => Promise<number>
    }
    connect: () => Promise<void>
    disconnect: () => Promise<void>
}
