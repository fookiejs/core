import {
	DataSource,
	DataSourceOptions,
	EntitySchema,
	EntitySchemaOptions,
	FindManyOptions,
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
import { Database, defaults, Method, Model, models, QueryType, Type, TypeStandartization } from "@fookiejs/core"
import { mapCoreTypeToTypeOrm } from "./type-mapping.ts"

interface TypedField {
	type: Type
	features: any[]
	isArray?: boolean
	enum?: Record<string, string | number>
}

const entityRegistry = new Map<string, EntitySchema>()
let dataSource: DataSource | null = null

type TypeOrmConfig = DataSourceOptions & {
	type: "postgres"
	host: string
	port: number
	username: string
	password: string
	database: string
}

export const database: Database = Database.create({
	key: "typeorm",
	primaryKeyType: defaults.types[TypeStandartization.String],
	modify: function (model: typeof Model) {
		const modelName = model.getName()

		return {
			[Method.CREATE]: async function (payload) {
				const repo = getRepository(modelName)
				return repo.save(payload.body)
			},

			[Method.READ]: async function (payload) {
				const repo = getRepository(modelName)
				const options: FindManyOptions = transformQueryToFindOptions(payload.query)
				options.withDeleted = false
				return repo.find(options)
			},

			[Method.UPDATE]: async function (payload) {
				const repo = getRepository(modelName)
				const where = transformFilterToWhere(payload.query)

				return await repo.manager.transaction(async (transactionalEntityManager) => {
					const qb = transactionalEntityManager
						.createQueryBuilder()
						.select("id")
						.from(modelName, "entity")
						.where(where)

					const results = await qb.getRawMany()
					const ids = results.map((r) => r.id)

					if (ids.length > 0) {
						await transactionalEntityManager
							.createQueryBuilder()
							.update(modelName)
							.set(payload.body)
							.whereInIds(ids)
							.execute()
					}

					return ids
				})
			},

			[Method.DELETE]: async function (payload) {
				const repo = getRepository(modelName)
				const where = transformFilterToWhere(payload.query)

				return await repo.manager.transaction(async (transactionalEntityManager) => {
					const qb = transactionalEntityManager
						.createQueryBuilder()
						.select("id")
						.from(modelName, "entity")
						.where(where)

					const results = await qb.getRawMany()
					const ids = results.map((r) => r.id)

					if (ids.length > 0) {
						const deleteBuilder = transactionalEntityManager
							.createQueryBuilder()
							.from(modelName, "entity")
							.whereInIds(ids)

						if (payload.options.hardDelete === true) {
							await deleteBuilder.delete().execute()
						} else {
							await deleteBuilder.softDelete().execute()
						}
					}

					return ids
				})
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

function transformQueryToFindOptions(query: QueryType<any>): FindManyOptions {
	const options: FindManyOptions = {
		select: query.attributes,
		where: transformFilterToWhere(query),
		skip: query.offset,
		take: query.limit === Infinity ? undefined : query.limit,
	}

	if (query.orderBy && Object.keys(query.orderBy).length > 0) {
		options.order = {}
		for (const [key, direction] of Object.entries(query.orderBy)) {
			options.order[key] = direction.toUpperCase() as "ASC" | "DESC"
		}
	}

	return options
}

function transformFilterToWhere(query: QueryType<any>): FindOptionsWhere<any> {
	const filter = query.filter || {}
	const where: FindOptionsWhere<any> = {}

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

function generateRandomSuffix(): string {
	return Math.random().toString(36).substring(2, 7)
}

function validateConfig(options: DataSourceOptions): asserts options is TypeOrmConfig {
	if (!options.type || options.type !== "postgres") {
		throw new Error("Only PostgreSQL is supported")
	}
	if (!options.host) throw new Error("Database host is required")
	if (!options.port) throw new Error("Database port is required")
	if (!options.username) throw new Error("Database username is required")
	if (!options.password) throw new Error("Database password is required")
	if (!options.database) throw new Error("Database name is required")
}

export const initializeDataSource = async function (options: DataSourceOptions): Promise<void> {
	validateConfig(options)

	if (dataSource && dataSource.isInitialized) {
		await dataSource.destroy()
	}

	entityRegistry.clear()

	const sessionId = generateRandomSuffix()
	const testModels = models.filter((m) => m.getName().includes("test") || m.getName().includes("Test"))
	const processedModelNames = new Set<string>()

	const entities = [
		...models.filter((m) => m.database().key === "typeorm"),
		...testModels,
	]
		.filter((model) => {
			const name = model.getName()
			if (processedModelNames.has(name)) {
				return false
			}
			processedModelNames.add(name)
			return true
		})
		.map((model) => {
			const schema = model.schema()
			const modelSuffix = `${sessionId}_${model.getName().substring(0, 3)}`

			const entityOptions: EntitySchemaOptions<any> = {
				name: model.getName(),
				tableName: model.getName(),
				indices: [
					{
						name: `IDX_${model.getName()}_${modelSuffix}_DELETED_AT`,
						columns: ["deletedAt"],
					},
					...Object.entries(schema).reduce((indices: any[], [key, value]) => {
						if (value.features.includes(defaults.feature.unique)) {
							indices.push({
								name: `UQ_${model.getName()}_${key}_${modelSuffix}`,
								columns: [key],
								unique: true,
							})
						}
						return indices
					}, []),
				],
				columns: {
					id: {
						type: String,
						primary: true,
						generated: "uuid",
					},
					createdAt: {
						type: Date,
						createDate: true,
					},
					updatedAt: {
						type: Date,
						updateDate: true,
					},
					deletedAt: {
						type: Date,
						deleteDate: true,
					},
					...Object.entries(schema).reduce((columns: any, [key, value]) => {
						try {
							const typedField = value as TypedField
							const typeInfo = mapCoreTypeToTypeOrm(typedField.type.type, {
								isArray: typedField.isArray,
								enum: typedField.enum,
							})

							columns[key] = {
								...typeInfo.options,
								type: typeInfo.type,
								nullable: !typedField.features?.includes(defaults.feature.required),
								primary: key === "id",
							}
						} catch (error) {
							console.warn(`Warning: ${error.message}. Field '${key}' will be skipped.`)
						}
						return columns
					}, {}),
				},
			}

			const entity = new EntitySchema(entityOptions)
			entityRegistry.set(model.getName(), entity)
			return entity
		})

	try {
		dataSource = new DataSource({
			...options,
			entities,
			synchronize: true,
		})
		await dataSource.initialize()
	} catch (error) {
		throw new Error(`Failed to initialize DataSource: ${error instanceof Error ? error.message : String(error)}`)
	}
}

export const INDEX = Symbol("index")

export function createTypeOrmEntity(model: typeof Model): EntitySchema {
	const schema = model.schema()
	const columns: Record<string, any> = {}

	for (const [fieldName, field] of Object.entries(schema)) {
		try {
			const typedField = field as TypedField
			const typeInfo = mapCoreTypeToTypeOrm(typedField.type.type, {
				isArray: typedField.isArray,
				enum: typedField.enum,
			})

			columns[fieldName] = {
				...typeInfo.options,
				type: typeInfo.type,
				nullable: !typedField.features?.includes(defaults.feature.required),
				primary: fieldName === "id",
			}
		} catch (error) {
			console.warn(`Warning: ${error.message}. Field '${fieldName}' will be skipped.`)
		}
	}

	return new EntitySchema({
		name: model.getName(),
		columns,
	})
}
