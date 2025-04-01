import {
	DataSource,
	DataSourceOptions,
	EntitySchema,
	FindOptionsWhere,
	In,
	IsNull,
	LessThan,
	LessThanOrEqual,
	Like,
	MoreThan,
	MoreThanOrEqual,
	Not,
	Repository,
} from "typeorm"
import { Database, defaults, Method, Model, models, QueryType, Utils } from "@fookiejs/core"

const entityRegistry = new Map<string, EntitySchema>()
let dataSource: DataSource | null = null

export const database: Database = Database.create({
	key: "typeorm",
	primaryKeyType: defaults.type.text,
	modify: function (model: typeof Model) {
		const modelName = model.name

		return {
			[Method.CREATE]: async function (payload) {
				const repo = getRepository(modelName)
				return repo.save(payload.body)
			},

			[Method.READ]: async function (payload) {
				const repo = getRepository(modelName)
				const options = transformQueryToFindOptions(payload.query)
				return repo.find(options)
			},

			[Method.UPDATE]: async function (payload) {
				const repo = getRepository(modelName)
				const where = transformFilterToWhere(payload.query)
				await repo.update(where, payload.body)
				return true
			},

			[Method.DELETE]: async function (payload) {
				const repo = getRepository(modelName)
				const where = transformFilterToWhere(payload.query)
				await repo.delete(where)
				return true
			},
		}
	},
}) as Database

function getRepository(entityName: string): Repository<any> {
	if (!dataSource) {
		throw new Error("DataSource is not initialized yet.")
	}
	const entity = entityRegistry.get(entityName)
	if (!entity) {
		throw new Error(`Entity ${entityName} not registered.`)
	}
	return dataSource.getRepository(entity)
}

function transformQueryToFindOptions(query: QueryType<any>) {
	const options: any = {
		select: query.attributes,
		where: transformFilterToWhere(query),
		skip: query.offset,
		take: query.limit === Infinity ? undefined : query.limit,
	}

	if (query.orderBy && Object.keys(query.orderBy).length > 0) {
		options.order = {}
		for (const [key, direction] of Object.entries(query.orderBy)) {
			options.order[key] = direction.toUpperCase()
		}
	}

	return options
}

function transformFilterToWhere(query: QueryType<any>): FindOptionsWhere<any> {
	const filter = query.filter || {}
	const where: any = {}

	for (const [key, condition] of Object.entries(filter)) {
		if (condition.equals !== undefined) where[key] = condition.equals
		else if (condition.notEquals !== undefined) where[key] = Not(condition.notEquals)
		else if (condition.in) where[key] = In(condition.in as string[])
		else if (condition.notIn) where[key] = Not(In(condition.notIn as string[]))
		else if (condition.lt !== undefined) where[key] = LessThan(condition.lt)
		else if (condition.lte !== undefined) where[key] = LessThanOrEqual(condition.lte)
		else if (condition.gt !== undefined) where[key] = MoreThan(condition.gt)
		else if (condition.gte !== undefined) where[key] = MoreThanOrEqual(condition.gte)
		else if (condition.like) where[key] = Like(condition.like)
		else if (condition.isNull !== undefined) where[key] = condition.isNull ? IsNull() : Not(IsNull())
	}

	return where
}

export const initializeDataSource = async function (options: DataSourceOptions): Promise<void> {
	const entities = models.filter((model) => model.database().key === "typeorm").map((model) => {
		const schema = model.schema()

		const entity = new EntitySchema({
			name: model.getName(),
			tableName: model.getName(),
			columns: Object.entries(schema).reduce((acc, [key, value]) => {
				acc[key] = (key === "id")
					? {
						primary: true,
						type: defaults.type.text.key,
						nullable: false,
					}
					: {
						type: Utils.includes(value.type.key, "[]") ? value.type.key.replace("[]", "") : value.type.key,
						array: Utils.includes(value.type.key, "[]"),
						nullable: !value.features.includes(defaults.feature.required),
						unique: value.features.includes(defaults.feature.unique),
					}

				return acc
			}, {}),
		})

		entityRegistry.set(model.getName(), entity)

		return entity
	})

	dataSource = new DataSource({
		...options,
		entities,
		migrations: options.migrations || ["migrations/*.ts"],
		synchronize: options.synchronize ?? true,
	})

	await dataSource.initialize()

	if (Array.isArray(options.migrations) && options.migrations.length > 0) {
		await dataSource.runMigrations()
	}
}

export const INDEX = Symbol("index")
