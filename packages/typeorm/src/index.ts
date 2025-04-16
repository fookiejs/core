import {
	DataSource,
	DataSourceOptions,
	EntitySchema,
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
import { Database, defaults, Method, Model, models, QueryType, Type, Utils } from "@fookiejs/core"
import { matchTypeOrmType } from "./match.ts"

const entityRegistry = new Map<string, EntitySchema>()
let dataSource: DataSource | null = null

export const database: Database = Database.create({
	key: "typeorm",
	primaryKeyType: defaults.type.text,
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

// Generate a random suffix for index names to make them unique
function generateRandomSuffix() {
	return Date.now().toString(36) + Math.random().toString(36).substring(2, 7)
}

export const initializeDataSource = async function (options: DataSourceOptions): Promise<void> {
	// Close existing connection if it exists
	if (dataSource && dataSource.isInitialized) {
		await dataSource.destroy()
	}

	// Clear the entity registry
	entityRegistry.clear()

	// Create a unique session ID to make all index names unique
	const sessionId = generateRandomSuffix()

	// Find models directly by name for test cases
	const testModels = models.filter((m) => m.getName().includes("test") || m.getName().includes("Test"))

	// Track processed model names to avoid duplicates
	const processedModelNames = new Set<string>()

	// Include both typeorm models and test models
	const entities = [
		...models.filter((m) => m.database().key === "typeorm"),
		...testModels,
	]
		.filter((model) => {
			const name = model.getName()
			// Skip duplicate models
			if (processedModelNames.has(name)) {
				return false
			}
			processedModelNames.add(name)
			return true
		})
		.map((model) => {
			const schema = model.schema()
			// Create model-specific suffix for truly unique constraints
			const modelSuffix = `${sessionId}_${model.getName().substring(0, 3)}`

			const entity = new EntitySchema({
				name: model.getName(),
				tableName: model.getName(),
				indices: [
					// No default indices to avoid conflicts
					/*{
						name: `IDX_${model.getName()}_${modelSuffix}_DELETED_AT`,
						columns: ["deletedAt"],
					},*/
					// Only keep unique constraints
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
						primary: true,
						type: "varchar",
						nullable: false,
					},
					createdAt: {
						type: "timestamp",
						createDate: true,
						nullable: false,
					},
					updatedAt: {
						type: "timestamp",
						updateDate: true,
						nullable: false,
					},
					deletedAt: {
						type: "timestamp",
						nullable: true,
						deleteDate: true,
					},
					...Object.entries(schema).reduce((acc, [key, value]) => {
						if (key === "id" || key === "createdAt" || key === "updatedAt" || key === "deletedAt") return acc

						try {
							let fieldType = value.type
							let isArray = false

							// Handle array types
							if (Utils.includes(value.type.key, "[]")) {
								fieldType = { ...value.type, key: value.type.key.replace("[]", "") }
								isArray = true
							}

							// Match with supported TypeORM type
							const typeInfo = matchTypeOrmType(fieldType)

							const columnDef: any = {
								type: typeInfo.type,
								array: isArray,
								nullable: !value.features.includes(defaults.feature.required),
								unique: value.features.includes(defaults.feature.unique),
							}

							// Add enum specific properties
							if (typeInfo.isEnum && typeInfo.enumValues) {
								columnDef.enum = typeInfo.enumValues
							}

							acc[key] = columnDef
						} catch (error) {
							throw new Error(`Field '${key}' in model '${model.getName()}': ${error.message}. Skipping field.`)
						}

						return acc
					}, {}),
				},
			})

			entityRegistry.set(model.getName(), entity)
			return entity
		})

	dataSource = new DataSource({
		...options,
		entities,
		migrations: options.migrations || ["migrations/*.ts"],
		synchronize: options.synchronize === undefined ? true : options.synchronize,
	})

	await dataSource.initialize()

	if (Array.isArray(options.migrations) && options.migrations.length > 0) {
		await dataSource.runMigrations()
	}
}

export const INDEX = Symbol("index")

export function createTypeOrmEntity(model: typeof Model): EntitySchema {
	const schema = model.schema()
	const columns: Record<string, any> = {}

	// Process each field in the model's schema
	for (const [fieldName, field] of Object.entries(schema)) {
		try {
			const typedField = field as { type: Type; required: boolean; features: any[] }

			// Special handling for array types
			if (typedField.type.key.includes("[]")) {
				const baseType = typedField.type.key.replace("[]", "")
				columns[fieldName] = {
					type: "simple-array",
					nullable: !typedField.required && !typedField.features?.includes(defaults.feature.required),
				}
				continue
			}

			// Match the field type with TypeORM type
			const typeInfo = matchTypeOrmType(typedField.type)

			const columnDef: any = {
				type: typeInfo.type,
				nullable: !typedField.required && !typedField.features?.includes(defaults.feature.required),
				primary: fieldName === "id",
			}

			// Add enum specific properties if needed
			if (typeInfo.isEnum && typeInfo.enumValues) {
				columnDef.enum = typeInfo.enumValues
			}

			columns[fieldName] = columnDef
		} catch (error) {
			// Log warning for unsupported fields but don't stop the process
			console.warn(`Warning: ${error.message}. Field '${fieldName}' will be skipped.`)
		}
	}

	// Create and return the EntitySchema
	return new EntitySchema({
		name: model.getName(),
		columns,
	})
}
