import { Model, BaseClass, ModelTypeOutput, Method } from "../exports"
import { Payload } from "./payload"
import { SchemaType } from "./schema"

export class Database extends BaseClass {
    modify: <model extends Model>(
        model: ModelTypeOutput,
        schema: SchemaType<model>,
    ) => {
        [Method.CREATE]: (payload: Payload<model>) => Promise<model>
        [Method.READ]: (payload: Payload<model>) => Promise<model[]>
        [Method.UPDATE]: (payload: Payload<model>) => Promise<boolean>
        [Method.DELETE]: (payload: Payload<model>) => Promise<boolean>
        [Method.SUM]: (payload: Payload<model>) => Promise<number>
        [Method.COUNT]: (payload: Payload<model>) => Promise<number>
    }
    connect: () => Promise<void>
    disconnect: () => Promise<void>
}
