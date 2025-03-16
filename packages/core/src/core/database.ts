import { Method } from "./method"
import { Model } from "./model/model"
import { Payload } from "./payload"

export class Database {
    key: string
    connect: () => Promise<void>
    disconnect: () => Promise<void>

    modify: <T extends Model>(
        model: typeof Model,
    ) => {
        create: (payload: Payload<T, Method.CREATE>) => Promise<T>
        read: (payload: Payload<T, Method.READ>) => Promise<T[]>
        update: (payload: Payload<T, Method.UPDATE>) => Promise<boolean>
        delete: (payload: Payload<T, Method.DELETE>) => Promise<boolean>
    }

    static new(data: Database): Database {
        const instance = new Database()
        return Object.assign(instance, data)
    }
}
