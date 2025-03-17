import { Database } from "../database.ts"
import { Effect, Filter, Modify, Role, Rule } from "../lifecycle-function.ts"
import { Method } from "../method.ts"
import { fillModel } from "./utils/create-model.ts"
import { createRun, deleteRun, readRun, updateRun } from "../run/run.ts"
import { SchemaType } from "../schema.ts"
import { Options } from "../option.ts"
import { Mixin } from "../mixin/index.ts"
import { Payload } from "../payload.ts"

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export const models: (typeof Model)[] = []

export const schemaSymbol = Symbol("schema")
const bindsSymbol = Symbol("binds")
const databaseSymbol = Symbol("database")
const mixinsSymbol = Symbol("mixins")

interface ModelMethods<model extends Model> {
  create: (payload: Payload<model, Method.CREATE>) => Promise<model>
  read: (payload: Payload<model, Method.READ>) => Promise<model[]>
  update: (payload: Payload<model, Method.UPDATE>) => Promise<boolean>
  delete: (payload: Payload<model, Method.DELETE>) => Promise<boolean>
}

export class Model {
  id!: string

  static async create<model extends Model>(
    this: new () => model,
    body: Omit<model, "id">,
    options?: Optional<Options, "test" | "sub">,
  ): Promise<model> {
    body
    options
    throw Error("Not implemented")
  }

  static async read<model extends Model>(
    this: new () => model,
    query?: Partial<QueryType<model>>,
    options?: Optional<Options, "test" | "sub">,
  ): Promise<model[]> {
    query
    options
    throw Error("Not implemented")
  }

  static async update<model extends Model>(
    this: new () => model,
    query: QueryType<model>,
    body: Partial<Omit<model, "id">>,
    options?: Optional<Options, "test" | "sub">,
  ): Promise<boolean> {
    query
    body
    options
    throw Error("Not implemented")
  }

  static async delete<model extends Model>(
    this: new () => model,
    query: Partial<QueryType<model>>,
    options?: Optional<Options, "test" | "sub">,
  ): Promise<boolean> {
    query
    options
    throw Error("Not implemented")
  }

  static schema<model extends Model>(this: new () => model): SchemaType<model> {
    return Reflect.getMetadata(schemaSymbol, this)
  }
  static binds<model extends Model>(this: new () => model): BindsType {
    return Reflect.getMetadata(bindsSymbol, this)
  }
  static database<model extends Model>(this: new () => model): Database {
    return Reflect.getMetadata(databaseSymbol, this)
  }
  static mixins<model extends Model>(this: new () => model): Mixin[] {
    return Reflect.getMetadata(mixinsSymbol, this)
  }

  static Decorator<model extends Model>(model: ModelTypeInput) {
    return function (constructor: typeof Model) {
      const existingModel = models.find((m) => m.getName() === model.name)
      if (existingModel) {
        throw new Error(`Model "${constructor.name}" already exists`)
      }

      if (!model.name) {
        model.name = constructor.name
      }

      const schema: SchemaType<model> = Reflect.getMetadata(
        schemaSymbol,
        constructor,
      )
      const filledModel = fillModel(model)
      const methods = filledModel.database.modify<model>(
        filledModel as unknown as typeof Model,
      ) as unknown as ModelMethods<model>

      Reflect.defineMetadata(schemaSymbol, schema, constructor)
      Reflect.defineMetadata(bindsSymbol, filledModel.binds, constructor)
      Reflect.defineMetadata(databaseSymbol, filledModel.database, constructor)
      Reflect.defineMetadata(mixinsSymbol, filledModel.mixins, constructor)

      Reflect.defineMetadata("modelName", model.name, constructor)

      constructor.create = createRun(methods.create) as typeof Model.create
      constructor.read = readRun(methods.read) as typeof Model.read
      constructor.update = updateRun(methods.update) as typeof Model.update
      constructor.delete = deleteRun(methods.delete) as typeof Model.delete

      models.push(constructor)
    }
  }

  static getName(): string {
    return Reflect.getMetadata("modelName", this) || this.name
  }
}

export type ModelTypeInput = {
  name?: string
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
  [ls in Method]?: BindsTypeField
}

export type BindsTypeField = {
  modify?: Modify<Model>[]
  role?: Role<Model>[]
  rule?: Rule<Model>[]
  filter?: Filter<Model>[]
  effect?: Effect<Model>[]
  accepts?:
    | []
    | [
      [
        Role<Model, Method>,
        { modify: Modify<Model, Method>[]; rule: Rule<Model, Method>[] },
      ],
    ]
  rejects?:
    | []
    | [
      [
        Role<Model, Method>,
        { modify: Modify<Model, Method>[]; rule: Rule<Model, Method>[] },
      ],
    ]
}

export class QueryType<model extends Model> {
  limit?: number
  offset?: number
  attributes?: string[]
  filter?: Partial<
    Record<
      keyof model,
      {
        gte?: number | string | Date
        gt?: number | string | Date
        lte?: number | string | Date
        lt?: number | string | Date
        equals?: number | string | Date | boolean
        notEquals?: number | string | Date | boolean
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
