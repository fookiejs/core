import { Database } from "../database"
import { LifecycleFunction } from "../lifecycle-function"
import { Method } from "../method"
import { fillModel } from "./utils/create-model"
import { countRun, createRun, deleteRun, readRun, sumRun, updateRun } from "../run/run"
import { FookieError } from "../error"
import { SchemaType } from "../schema"
import { Options } from "../option"
import { Mixin } from "../mixin/index"

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export const models: {
    schema: SchemaType<Model>
    database: Database
    binds?: BindsType | undefined
    modelClass: new () => Model
}[] = []

export class Model {
    id: string

    static async create<ModelClass extends Model>(
        this: new () => ModelClass,
        body: Omit<ModelClass, "id">,
        options?: Options,
    ): Promise<ModelClass | FookieError> {
        body
        options
        throw Error("Not implemented")
    }

    static async read<ModelClass extends Model>(
        this: new () => ModelClass,
        query?: QueryType<ModelClass>,
        options?: Options,
    ): Promise<ModelClass[]> {
        query
        options
        throw Error("Not implemented")
    }

    static async update<ModelClass extends Model>(
        this: new () => ModelClass,
        query: QueryType<ModelClass>,
        body: Partial<Omit<ModelClass, "id">>,
        options?: Options,
    ): Promise<boolean> {
        query
        body
        options
        throw Error("Not implemented")
    }

    static async delete<ModelClass extends Model>(
        this: new () => ModelClass,
        query: QueryType<ModelClass>,
        options?: Options,
    ): Promise<boolean> {
        query
        options
        throw Error("Not implemented")
    }

    static async count<ModelClass extends Model>(
        this: new () => ModelClass,
        query: QueryType<ModelClass>,
        options?: Options,
    ): Promise<number> {
        query
        options
        throw Error("Not implemented")
    }

    static async sum<ModelClass extends Model>(
        this: new () => ModelClass,
        query: QueryType<ModelClass>,
        field: string,
        options?: Options,
    ): Promise<number> {
        query
        field
        options
        throw Error("Not implemented")
    }

    static Decorator(model: Optional<ModelType, "binds" | "mixins">) {
        return function <ModelClass extends Model>(constructor: new () => ModelClass) {
            const schema: SchemaType<ModelClass> = Reflect.getMetadata("schema", constructor)

            const filled = fillModel(model)

            const methods = filled.database.modify<ModelClass>(filled, schema)

            constructor.create = createRun<ModelClass>(filled, schema, constructor, methods.create)
            constructor.read = readRun<ModelClass>(filled, schema, constructor, methods.read)
            constructor.update = updateRun<ModelClass>(filled, schema, constructor, methods.update)
            constructor.delete = deleteRun<ModelClass>(filled, schema, constructor, methods.del)
            constructor.count = countRun<ModelClass>(filled, schema, constructor, methods.count)
            constructor.sum = sumRun<ModelClass>(filled, schema, constructor, methods.sum)

            Reflect.defineMetadata("model", model, constructor)
            const m = { modelClass: constructor, ...model, schema: schema }
            models.push(m)
        }
    }
}

export type ModelType = {
    database: Database
    binds: BindsType
    mixins: Mixin[]
}

export type BindsType = {
    [ls in Method]: {
        preRule: LifecycleFunction<Model, unknown>[]
        modify: LifecycleFunction<Model, unknown>[]
        role: LifecycleFunction<Model, unknown>[]
        rule: LifecycleFunction<Model, unknown>[]
        filter: LifecycleFunction<Model, unknown>[]
        effect: LifecycleFunction<Model, unknown>[]
        accept?: {
            [key: string]: {
                modify: LifecycleFunction<Model, unknown>[]
                rule: LifecycleFunction<Model, unknown>[]
            }
        }
        reject?: {
            [key: string]: {
                modify: LifecycleFunction<Model, unknown>[]
                rule: LifecycleFunction<Model, unknown>[]
            }
        }
    }
}

export class QueryType<ModelClass extends Model> {
    limit: number
    offset: number
    attributes: (keyof ModelClass)[]
    filter: Record<
        keyof ModelClass,
        {
            gte?: number | string | Date
            gt?: number | string | Date
            lte?: number | string | Date
            lt?: number | string | Date
            equals?: number | string | Date
            notEquals?: number | string | Date
            in?: number[] | string[]
            notIn?: number[] | string[]
            like?: string
            notLike?: string | Date
            isNull?: boolean
            isNotNull?: boolean
            [keyword: string]: unknown
        }
    >
}
