import { Database } from "../database"
import { LifecycleFunction } from "../lifecycle-function"
import { Method } from "../method"
import { fillModel } from "./utils/create-model"
import { countRun, createRun, deleteRun, readRun, sumRun, updateRun } from "../run/run"
import { FookieError } from "../error"
import { SchemaType } from "../schema"
import { Options } from "../option"
import { Mixin } from "../mixin/index"

export const models: {
    schema: SchemaType<typeof Model>
    database: Database
    binds?: BindsType | undefined
    modelClass: typeof Model
}[] = []

export class Model {
    id: string

    static async create<T extends Model>(
        this: new () => T,
        body: Omit<T, "id">,
        options?: Options,
    ): Promise<T | FookieError> {
        body
        options
        throw Error("Not implemented")
    }

    static async read<T extends Model>(
        this: new () => T,
        query?: QueryType<T>,
        options?: Options,
    ): Promise<T[]> {
        query
        options
        throw Error("Not implemented")
    }

    static async update<T extends Model>(
        this: new () => T,
        query: QueryType<T>,
        body: Partial<Omit<T, "id">>,
        options?: Options,
    ): Promise<boolean> {
        query
        body
        options
        throw Error("Not implemented")
    }

    static async delete<T extends Model>(
        this: new () => T,
        query: QueryType<T>,
        options?: Options,
    ): Promise<boolean> {
        query
        options
        throw Error("Not implemented")
    }

    static async count<T extends Model>(
        this: new () => T,
        query: QueryType<T>,
        options?: Options,
    ): Promise<number> {
        query
        options
        throw Error("Not implemented")
    }

    static async sum<T extends Model>(
        this: new () => T,
        query: QueryType<T>,
        field: string,
        options?: Options,
    ): Promise<number> {
        query
        field
        options
        throw Error("Not implemented")
    }

    static Decorator(model: ModelType) {
        return function <T extends typeof Model>(constructor: T) {
            const schema: SchemaType<T> = Reflect.getMetadata("schema", constructor)

            const filledModel = fillModel(model)

            const methods = filledModel.database.modify<T>(filledModel, schema)

            constructor.create = createRun<T>(model, schema, constructor, methods.create)
            constructor.read = readRun<T>(model, schema, constructor, methods.read)
            constructor.update = updateRun<T>(model, schema, constructor, methods.update)
            constructor.delete = deleteRun<T>(model, schema, constructor, methods.del)
            constructor.count = countRun<T>(model, schema, constructor, methods.count)
            constructor.sum = sumRun<T>(model, schema, constructor, methods.sum)

            Reflect.defineMetadata("model", model, constructor)
            const m = { modelClass: constructor, ...model, schema: schema }
            models.push(m)
        }
    }
}

export type ModelType = {
    database: Database
    binds?: BindsType
    mixins?: Mixin[]
}

export type BindsType = {
    [ls in Method]?: {
        preRule?: LifecycleFunction<typeof Model, unknown>[]
        modify?: LifecycleFunction<typeof Model, unknown>[]
        role?: LifecycleFunction<typeof Model, unknown>[]
        rule?: LifecycleFunction<typeof Model, unknown>[]
        filter?: LifecycleFunction<typeof Model, unknown>[]
        effect?: LifecycleFunction<typeof Model, unknown>[]
        accept?: {
            [key: string]: {
                modify: LifecycleFunction<typeof Model, unknown>[]
                rule: LifecycleFunction<typeof Model, unknown>[]
            }
        }
        reject?: {
            [key: string]: {
                modify: LifecycleFunction<typeof Model, unknown>[]
                rule: LifecycleFunction<typeof Model, unknown>[]
            }
        }
    }
}

export type QueryType<T> = {
    limit?: number
    offset?: number
    attributes?: string[]
    filter?: {
        [key in keyof Partial<T>]: {
            gte?: number | string | Date
            gt?: number | string | Date
            lte?: number | string | Date
            lt?: number | string | Date
            equals?: number | string | Date
            notEquals?: number | string | Date
            in?: number[] | string[]
            notIn?: number[] | string[]
            like?: string | Date
            notLike?: string | Date
            isNull?: boolean
            isNotNull?: boolean
            [keyword: string]: any
        }
    }
}
