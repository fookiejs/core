import { Method } from "./method"
import { Model } from "./model/model"
import { Payload } from "./payload"
import { MethodResponse } from "./response"

export class Modify<T extends Model = Model, M extends Method = Method> {
    key: string
    execute: (payload: Payload<T, M>) => Promise<void>

    static new<T extends Model = Model, M extends Method = Method>(
        data: Modify<T, M>,
    ): Modify<T, M> {
        const instance = new Modify<T, M>()
        Object.assign(instance, data)
        return instance
    }
}

export class Role<T extends Model = Model, M extends Method = Method> {
    key: string
    execute: (payload: Payload<T, M>) => Promise<boolean>

    static new<T extends Model = Model, M extends Method = Method>(data: Role<T, M>): Role<T, M> {
        const instance = new Role<T, M>()
        Object.assign(instance, data)
        return instance
    }
}

export class Rule<T extends Model = Model, M extends Method = Method> {
    key: string
    execute: (payload: Payload<T, M>) => Promise<boolean>

    static new<T extends Model = Model, M extends Method = Method>(data: Rule<T, M>): Rule<T, M> {
        const instance = new Rule<T, M>()
        instance.key = data.key
        instance.execute = data.execute
        return instance
    }
}

export class Filter<T extends Model = Model, M extends Method = Method> {
    key: string
    execute: (payload: Payload<T, M>, response: MethodResponse<T>[M]) => Promise<void>

    static new<T extends Model = Model, M extends Method = Method>(
        data: Filter<T, M>,
    ): Filter<T, M> {
        const instance = new Filter<T, M>()
        instance.key = data.key
        instance.execute = data.execute
        return instance
    }
}

export class Effect<T extends Model = Model, M extends Method = Method> {
    key: string
    execute: (payload: Payload<T, M>, response: MethodResponse<T>[M]) => Promise<void>

    static new<T extends Model = Model, M extends Method = Method>(
        data: Effect<T, M>,
    ): Effect<T, M> {
        const instance = new Effect<T, M>()
        instance.key = data.key
        instance.execute = data.execute
        return instance
    }
}
