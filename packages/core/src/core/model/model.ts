import { Database } from "../database.ts"
import { Effect, Filter, Modify, Role, Rule } from "../lifecycle-function.ts"
import { Method } from "../method.ts"
import { fillModel } from "./utils/create-model.ts"
import { createRun, deleteRun, readRun, updateRun } from "../run/run.ts"
import { SchemaType } from "../schema.ts"
import { Options } from "../option.ts"
import { Mixin } from "../mixin/index.ts"
import { Payload } from "../payload.ts"
import * as lodash from "lodash"
import { fillSchema } from "../field/utils/fill-schema.ts"
import { Utils } from "../../utils/util.ts"

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export const models: (typeof Model)[] = []

export const schemaSymbol = Symbol("schema")
const bindsSymbol = Symbol("binds")
export const databaseSymbol = Symbol("database")
const mixinsSymbol = Symbol("mixins")
const modelNameSymbol = Symbol("modelName")

interface ModelMethods<model extends Model> {
	create: (payload: Payload<model, Method.CREATE>) => Promise<model>
	read: (payload: Payload<model, Method.READ>) => Promise<model[]>
	update: (payload: Payload<model, Method.UPDATE>) => Promise<boolean>
	delete: (payload: Payload<model, Method.DELETE>) => Promise<boolean>
}

export class Model {
	id!: string
	createdAt!: string
	updatedAt!: string
	deletedAt!: string | null

	static async create<model extends Model>(
		this: new () => model,
		body: Omit<model, "id" | "createdAt" | "updatedAt" | "deletedAt">,
		options?: Optional<Options, "test" | "token">,
	): Promise<model> {
		body
		options
		throw Error("Not implemented")
	}

	static async read<model extends Model>(
		this: new () => model,
		query?: Partial<QueryType<model>>,
		options?: Optional<Options, "test" | "token">,
	): Promise<model[]> {
		query
		options
		throw Error("Not implemented")
	}

	static async update<model extends Model>(
		this: new () => model,
		query: QueryType<model>,
		body: Partial<Omit<model, "id" | "createdAt" | "updatedAt" | "deletedAt">>,
		options?: Optional<Options, "test" | "token">,
	): Promise<boolean> {
		query
		body
		options
		throw Error("Not implemented")
	}

	static async delete<model extends Model>(
		this: new () => model,
		query: Partial<QueryType<model>>,
		options?: Optional<Options, "test" | "token">,
	): Promise<boolean> {
		query
		options
		throw Error("Not implemented")
	}

	static schema<model extends Model>(this: new () => model): SchemaType<model> {
		return this[Symbol.metadata][schemaSymbol] as SchemaType<model>
	}
	static binds<model extends Model>(this: new () => model): BindsType {
		return this[Symbol.metadata][bindsSymbol] as BindsType
	}
	static database<model extends Model>(this: new () => model): Database {
		return this[Symbol.metadata][databaseSymbol] as Database
	}
	static mixins<model extends Model>(this: new () => model): Mixin[] {
		return this[Symbol.metadata][mixinsSymbol] as Mixin[]
	}

	static Decorator<M extends Model>(model: ModelTypeInput): (constructor: typeof Model, descriptor: any) => void {
		return function (constructor: typeof Model, descriptor: any) {
			const existingModel = models.find((m) => m.getName() === model.name)
			if (existingModel) {
				throw new Error(`Model "${constructor.name}" already exists`)
			}

			if (!model.name) {
				model.name = constructor.name
			}

			const modelCopy: ModelTypeInput = {
				...model,
				binds: model.binds ? lodash.cloneDeep(model.binds) : {},
				mixins: model.mixins ? [...model.mixins] : [],
			}

			descriptor.metadata[schemaSymbol]["id"] = fillSchema({
				type: modelCopy.database.primaryKeyType,
			})

			for (const key in descriptor.metadata[schemaSymbol]) {
				const field = descriptor.metadata[schemaSymbol][key]
				if (Utils.has(field, "relation")) {
					field.type = modelCopy.database.primaryKeyType
				}
			}

			const filledModel = fillModel(modelCopy)
			const methods = filledModel.database.modify<M>(
				filledModel as unknown as typeof Model,
			) as unknown as ModelMethods<M>

			descriptor.metadata[bindsSymbol] = filledModel.binds
			descriptor.metadata[databaseSymbol] = filledModel.database
			descriptor.metadata[mixinsSymbol] = filledModel.mixins
			descriptor.metadata[modelNameSymbol] = model.name

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
				{ modify?: Modify<Model, Method>[]; rule?: Rule<Model, Method>[] },
			],
		]
	rejects?:
		| []
		| [
			[
				Role<Model, Method>,
				{ modify?: Modify<Model, Method>[]; rule?: Rule<Model, Method>[] },
			],
		]
}

export class QueryType<model extends Model> {
	limit?: number
	offset?: number
	orderBy?: {
		[key in keyof model]?: "asc" | "desc"
	}
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
