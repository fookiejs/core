import * as lodash from "lodash"
import { Database } from "../database/database.ts"
import { Effect, Filter, Modify, Role, Rule } from "../run/lifecycle-function.ts"
import { Lifecycle } from "../run/lifecycle.ts"
import { Method } from "../method/method.ts"
import { fillModel } from "./utils/create-model.ts"
import { createRun, deleteRun, readRun, updateRun } from "../run/run.ts"
import { SchemaType } from "./schema.ts"
import { Options } from "../payload/option.ts"
import { Mixin } from "../mixin/index.ts"
import { Payload } from "../payload/payload.ts"
import { fillSchema } from "../field/utils/fill-schema.ts"
import { Utils } from "../utils/util.ts"
import { Field } from "../field/field.ts"
import { defaults } from "../defaults/index.ts"
import { TypeStandartization } from "../type/standartization.ts"
import { QueryType } from "../query/query.ts"
import { CoreTypes } from "../type/types.ts"

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export const models: (typeof Model)[] = []

export const schemaSymbol = Symbol("schema")
export const bindsSymbol = Symbol("binds")
export const databaseSymbol = Symbol("database")
export const mixinsSymbol = Symbol("mixins")
export const modelNameSymbol = Symbol("modelName")

interface ModelMethods<model extends Model> {
	create: (payload: Payload<model, Method.CREATE>) => Promise<model>
	read: (payload: Payload<model, Method.READ>) => Promise<model[]>
	update: (payload: Payload<model, Method.UPDATE>) => Promise<string[]>
	delete: (payload: Payload<model, Method.DELETE>) => Promise<string[]>
}

interface FookieDecoratorContext {
	metadata?: {
		[schemaSymbol]?: Record<string, Field>
		[bindsSymbol]?: BindsType
		[databaseSymbol]?: Database
		[mixinsSymbol]?: Mixin[]
		[modelNameSymbol]?: string
		[key: symbol]: any
	}
	name?: string | symbol
}

export class Model {
	id?: string
	createdAt?: string
	updatedAt?: string
	deletedAt?: string | null

	static async create<model extends Model>(
		this: new () => model,
		body: Omit<model, "id" | "createdAt" | "updatedAt" | "deletedAt">,
		options?: Optional<Options, "test" | "token">,
	): Promise<model> {
		body
		options
		throw new Error("Not implemented - assigned by decorator")
	}

	static async read<model extends Model>(
		this: new () => model,
		query?: Partial<QueryType<model>>,
		options?: Optional<Options, "test" | "token">,
	): Promise<model[]> {
		query
		options
		throw new Error("Not implemented - assigned by decorator")
	}

	static async update<model extends Model>(
		this: new () => model,
		query: QueryType<model>,
		body: Partial<Omit<model, "id" | "createdAt" | "updatedAt" | "deletedAt">>,
		options?: Optional<Options, "test" | "token">,
	): Promise<string[]> {
		query
		body
		options
		throw new Error("Not implemented - assigned by decorator")
	}

	static async delete<model extends Model>(
		this: new () => model,
		query: Partial<QueryType<model>>,
		options?: Optional<Options, "test" | "token">,
	): Promise<string[]> {
		query
		options
		throw new Error("Not implemented - assigned by decorator")
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

	static Decorator<M extends Model>(
		model: ModelTypeInput,
	): (constructor: typeof Model, descriptor: FookieDecoratorContext) => void {
		return function (constructor: typeof Model, descriptor: FookieDecoratorContext) {
			if (!descriptor || !descriptor.metadata) {
				console.warn("Model decorator missing descriptor or metadata, initializing.")
				descriptor = { metadata: {} }
			}
			descriptor.metadata[schemaSymbol] = descriptor.metadata[schemaSymbol] ?? {}
			descriptor.metadata[bindsSymbol] = descriptor.metadata[bindsSymbol] ?? {}
			descriptor.metadata[mixinsSymbol] = descriptor.metadata[mixinsSymbol] ?? []
			descriptor.metadata[modelNameSymbol] = descriptor.metadata[modelNameSymbol] ?? ""

			const modelName = model.name || constructor.name
			const existingModel = models.find((m) => m.getName() === modelName)
			if (existingModel) {
				throw new Error(`Model "${modelName}" already exists`)
			}

			if (!model.name) {
				model.name = modelName
			}

			const modelCopy: ModelTypeInput = {
				...model,
				mixins: model.mixins ? [...model.mixins] : [],
			}

			if (!modelCopy.database) {
				throw new Error("Database is required")
			}
			if (!modelCopy.database.primaryKeyType) {
				throw new Error(`Database definition for model "${modelName}" must include primaryKeyType.`)
			}
			const primaryKeyType = modelCopy.database.primaryKeyType

			const schemaMeta = descriptor.metadata[schemaSymbol] as Record<string, Field>
			schemaMeta["id"] = fillSchema({
				type: primaryKeyType,
			})
			schemaMeta["deletedAt"] = fillSchema({
				type: TypeStandartization.Timestamp,
				default: null,
			})
			schemaMeta["createdAt"] = fillSchema({
				type: TypeStandartization.Timestamp,
				features: [defaults.feature.required],
			})
			schemaMeta["updatedAt"] = fillSchema({
				type: TypeStandartization.Timestamp,
				features: [defaults.feature.required],
			})

			for (const key in schemaMeta) {
				const field = schemaMeta[key]
				if (Utils.has(field, "relation")) {
					field.type = CoreTypes[field.relation.database().primaryKeyType].type
				}
			}

			const filledModel = fillModel(modelCopy)
			const methods: ModelMethods<M> = filledModel.database.modify(constructor)

			descriptor.metadata[bindsSymbol] = filledModel.binds
			descriptor.metadata[databaseSymbol] = filledModel.database
			descriptor.metadata[mixinsSymbol] = filledModel.mixins
			descriptor.metadata[modelNameSymbol] = modelName

			constructor.create = createRun(methods.create) as typeof Model.create
			constructor.read = readRun(methods.read) as typeof Model.read
			constructor.update = updateRun(methods.update) as typeof Model.update
			constructor.delete = deleteRun(methods.delete) as typeof Model.delete

			models.push(constructor)
		}
	}

	static getName(): string {
		const nameFromMeta = this[Symbol.metadata]?.[modelNameSymbol]
		return typeof nameFromMeta === "string" && nameFromMeta ? nameFromMeta : this.name
	}

	static addLifecycle<model extends Model>(
		this: new () => model,
		method: Method,
		lifecycle: Modify<model> | Role<model> | Rule<model> | Filter<model> | Effect<model>,
	): void {
		const binds = this[Symbol.metadata][bindsSymbol] as BindsType

		if (!binds[method]) {
			throw new Error(`Method ${method} is not initialized in binds. Make sure the model is properly decorated.`)
		}

		if (lifecycle instanceof Modify) {
			binds[method]![Lifecycle.MODIFY] = binds[method]![Lifecycle.MODIFY] || []
			binds[method]![Lifecycle.MODIFY]!.push(lifecycle as Modify<Model>)
		} else if (lifecycle instanceof Role) {
			binds[method]![Lifecycle.ROLE] = binds[method]![Lifecycle.ROLE] || []
			binds[method]![Lifecycle.ROLE]!.push(lifecycle as Role<Model>)
		} else if (lifecycle instanceof Rule) {
			binds[method]![Lifecycle.RULE] = binds[method]![Lifecycle.RULE] || []
			binds[method]![Lifecycle.RULE]!.push(lifecycle as Rule<Model>)
		} else if (lifecycle instanceof Filter) {
			binds[method]![Lifecycle.FILTER] = binds[method]![Lifecycle.FILTER] || []
			binds[method]![Lifecycle.FILTER]!.push(lifecycle as Filter<Model>)
		} else if (lifecycle instanceof Effect) {
			binds[method]![Lifecycle.EFFECT] = binds[method]![Lifecycle.EFFECT] || []
			binds[method]![Lifecycle.EFFECT]!.push(lifecycle as Effect<Model>)
		}
	}
}

export type ModelTypeInput = {
	name?: string
	database: Database
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
	[Lifecycle.MODIFY]?: Modify<Model>[]
	[Lifecycle.ROLE]?: Role<Model>[]
	[Lifecycle.RULE]?: Rule<Model>[]
	[Lifecycle.FILTER]?: Filter<Model>[]
	[Lifecycle.EFFECT]?: Effect<Model>[]
}
