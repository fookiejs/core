import { Model, BaseClass, ModelTypeOutput, Method } from "../exports"
import { Payload } from "./payload"
import { SchemaType } from "./schema"

export class Database extends BaseClass {
    modify: <ModelClass extends Model>(
        model: ModelTypeOutput,
        schema: SchemaType<ModelClass>,
    ) => {
        [Method.CREATE]: (payload: Payload<ModelClass>) => Promise<ModelClass>
        [Method.READ]: (payload: Payload<ModelClass>) => Promise<ModelClass[]>
        [Method.UPDATE]: (payload: Payload<ModelClass>) => Promise<boolean>
        [Method.DELETE]: (payload: Payload<ModelClass>) => Promise<boolean>
        [Method.SUM]: (payload: Payload<ModelClass>) => Promise<number>
        [Method.COUNT]: (payload: Payload<ModelClass>) => Promise<number>
    }
    connect: () => Promise<void>
    disconnect: () => Promise<void>
}
