import { Database } from "../database"
import { Effect, Filter, Modify, PreRule, Role, Rule } from "../lifecycle-function"
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
    binds: BindsType
    modelClass: typeof Model
}[] = []

export class Model {
    id: string

    static async create<ModelClass extends Model>(
        this: new () => ModelClass,
        body: Omit<ModelClass, "id">,
        options?: Optional<Options, "drop" | "test" | "token">,
    ): Promise<ModelClass | FookieError> {
        body
        options
        throw Error("Not implemented")
    }

    static async read<ModelClass extends Model>(
        this: new () => ModelClass,
        query?: Partial<QueryType<ModelClass>>,
        options?: Optional<Options, "drop" | "test" | "token">,
    ): Promise<ModelClass[]> {
        query
        options
        throw Error("Not implemented")
    }

    static async update<ModelClass extends Model>(
        this: new () => ModelClass,
        query: QueryType<ModelClass>,
        body: Partial<Omit<ModelClass, "id">>,
        options?: Optional<Options, "drop" | "test" | "token">,
    ): Promise<boolean> {
        query
        body
        options
        throw Error("Not implemented")
    }

    static async delete<ModelClass extends Model>(
        this: new () => ModelClass,
        query: Partial<QueryType<ModelClass>>,
        options?: Optional<Options, "drop" | "test" | "token">,
    ): Promise<boolean> {
        query
        options
        throw Error("Not implemented")
    }

    static async count<ModelClass extends Model>(
        this: new () => ModelClass,
        query: Partial<QueryType<ModelClass>>,
        options?: Optional<Options, "drop" | "test" | "token">,
    ): Promise<number> {
        query
        options
        throw Error("Not implemented")
    }

    static async sum<ModelClass extends Model>(
        this: new () => ModelClass,
        query: Partial<QueryType<ModelClass>>,
        field: string,
        options?: Optional<Options, "drop" | "test" | "token">,
    ): Promise<number> {
        query
        field
        options
        throw Error("Not implemented")
    }

    static Decorator<ModelClass extends Model>(model: ModelTypeInput) {
        return function (constructor: typeof Model) {
            const schema: SchemaType<ModelClass> = Reflect.getMetadata("schema", constructor)

            const filled = fillModel(model)

            const methods = filled.database.modify<ModelClass>(filled, schema)

            Reflect.defineMetadata("methods", methods, constructor)

            //@ts-expect-error: TODO
            constructor.create = createRun(filled, schema) //@ts-expect-error: TODO
            constructor.read = readRun(filled, schema) //@ts-expect-error: TODO
            constructor.update = updateRun(filled, schema) //@ts-expect-error: TODO
            constructor.delete = deleteRun(filled, schema) // @ts-expect-error: TODO
            constructor.count = countRun(filled, schema) // @ts-expect-error: TODO
            constructor.sum = sumRun(filled, schema)

            const m = { modelClass: constructor, ...filled, schema: schema }
            models.push(m)
        }
    }
}

export type ModelTypeInput = {
    database: Database
    binds?: { [ls in Method]?: Partial<BindsTypeField> }
    mixins?: Mixin[]
}

export type ModelTypeOutput = {
    database: Database
    binds: BindsType
    mixins: Mixin[]
}

export type BindsType = {
    [ls in Method]: BindsTypeField
}

export type BindsTypeField = {
    preRule: PreRule<Model>[]
    modify: Modify<Model>[]
    role: Role<Model>[]
    rule: Rule<Model>[]
    filter: Filter<Model>[]
    effect: Effect<Model>[]
    accept?: {
        [key: string]: {
            modify: Modify<Model>[]
            rule: Rule<Model>[]
        }
    }
    reject?: {
        [key: string]: {
            modify: Modify<Model>[]
            rule: Rule<Model>[]
        }
    }
}

export class QueryType<ModelClass extends Model> {
    limit: number
    offset: number
    attributes: Array<keyof ModelClass>
    filter: Partial<
        Record<
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
    >
}
