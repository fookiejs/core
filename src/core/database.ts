import { Method, Model } from "../exports"
import { Payload } from "./payload"

export class Database {
    key: string
    connect: () => Promise<void>
    disconnect: () => Promise<void>

    modify: <T extends Model>(
        model: typeof Model,
    ) => {
        [Method.CREATE]: (payload: Payload<T, Method.CREATE>) => Promise<T>
        [Method.READ]: (payload: Payload<T, Method.READ>) => Promise<T[]>
        [Method.UPDATE]: (payload: Payload<T, Method.UPDATE>) => Promise<boolean>
        [Method.DELETE]: (payload: Payload<T, Method.DELETE>) => Promise<boolean>
    }

    static new(data: Database): Database {
        const instance = new Database()
        return Object.assign(instance, data)
    }
}
