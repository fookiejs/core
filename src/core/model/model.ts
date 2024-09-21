import { Database } from "../database"
import { Effect, Filter, Modify, Role, Rule } from "../lifecycle-function"
import { Method } from "../method"
import { fillModel } from "./utils/create-model"
import { countRun, createRun, deleteRun, readRun, sumRun, updateRun } from "../run/run"
import { FookieError } from "../error"
import { SchemaType } from "../schema"
import { Options } from "../option"
import { Mixin } from "../mixin/index"

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export const models: (typeof Model)[] = []

export const schemaSymbol = Symbol("schema")
const bindsSymbol = Symbol("binds")
const databaseSymbol = Symbol("database")
const mixinsSymbol = Symbol("mixins")

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

    static schema<ModelClass extends Model>(this: new () => ModelClass): SchemaType<ModelClass> {
        return Reflect.getMetadata(schemaSymbol, this)
    }
    static binds<ModelClass extends Model>(this: new () => ModelClass): BindsType {
        return Reflect.getMetadata(bindsSymbol, this)
    }
    static database<ModelClass extends Model>(this: new () => ModelClass): Database {
        return Reflect.getMetadata(databaseSymbol, this)
    }
    static mixins<ModelClass extends Model>(this: new () => ModelClass): Mixin[] {
        return Reflect.getMetadata(mixinsSymbol, this)
    }

    static Decorator<ModelClass extends Model>(model: ModelTypeInput) {
        return function (constructor: typeof Model) {
            const schema: SchemaType<ModelClass> = Reflect.getMetadata(schemaSymbol, constructor)

            const filledModel = fillModel(model)

            const methods = filledModel.database.modify<ModelClass>(filledModel, schema)

            Reflect.defineMetadata(schemaSymbol, schema, constructor)
            Reflect.defineMetadata(bindsSymbol, filledModel.binds, constructor)
            Reflect.defineMetadata(databaseSymbol, filledModel.database, constructor)
            Reflect.defineMetadata(mixinsSymbol, filledModel.mixins, constructor)

            //@ts-expect-error: TODO
            constructor.create = createRun(methods.create) //@ts-expect-error: TODO
            constructor.read = readRun(methods.read) //@ts-expect-error: TODO
            constructor.update = updateRun(methods.update) //@ts-expect-error: TODO
            constructor.delete = deleteRun(methods.delete) // @ts-expect-error: TODO
            constructor.count = countRun(methods.count) // @ts-expect-error: TODO
            constructor.sum = sumRun(methods.sum)

            models.push(constructor)
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
    modify: Modify<Model>[]
    role: Role<Model>[]
    rule: Rule<Model>[]
    filter: Filter<Model>[]
    effect: Effect<Model>[]
    accepts:
        | [
              [
                  Role<Model>,
                  {
                      modify: Modify<Model>[]
                      rule: Rule<Model>[]
                  },
              ],
          ]
        | []

    rejects:
        | [
              [
                  Role<Model>,
                  {
                      modify: Modify<Model>[]
                      rule: Rule<Model>[]
                  },
              ],
          ]
        | []
}

export class QueryType<ModelClass extends Model> {
    limit: number
    offset: number
    attributes: string[]
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
