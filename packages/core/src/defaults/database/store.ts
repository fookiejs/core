import { Database } from "../../core/database.ts"
import type { Model, QueryType } from "../../core/model/model.ts"
import { Method } from "../../core/method.ts"
import type { Payload } from "../../core/payload.ts"
import { types } from "../type/types.ts"
import { defaults } from "../index.ts"

function checkUniqueConstraints<T extends Model>(
	model: typeof Model,
	entity: T,
	pool: T[],
	excludeId?: string,
): boolean {
	const schema = model.schema()
	for (const [field, fieldSchema] of Object.entries(schema)) {
		if (fieldSchema.features.includes(defaults.feature.unique)) {
			const value = entity[field as keyof T]
			const existingEntity = pool.find((e) =>
				e[field as keyof T] === value &&
				e.deletedAt === null &&
				(!excludeId || e.id !== excludeId)
			)
			if (existingEntity) {
				throw new Error(`Unique constraint violation: ${field} must be unique`)
			}
		}
	}
	return true
}

export const store = Database.create({
	key: "store",
	primaryKeyType: types.text,
	modify: function <T extends Model>(model: typeof Model) {
		const pool: T[] = []
		return {
			[Method.CREATE]: async (payload: Payload<T, Method.CREATE>) => {
				const now = new Date().toISOString()
				payload.body.createdAt = now
				payload.body.updatedAt = now

				checkUniqueConstraints(model, payload.body, pool)

				pool.push(payload.body)
				return payload.body
			},
			[Method.READ]: async (payload: Payload<T, Method.READ>) => {
				const matchingEntities: T[] = []
				for (const entity of pool) {
					if (isEntityMatchingQuery(entity, payload.query) && entity.deletedAt === null) {
						matchingEntities.push(entity)
					}
				}

				if (payload.query.orderBy && Object.keys(payload.query.orderBy).length > 0) {
					sortEntities(matchingEntities, payload.query.orderBy || {})
				}

				const start = payload.query.offset || 0
				const end = start + (payload.query.limit || matchingEntities.length)
				const paginatedResults = matchingEntities.slice(start, end)

				if (payload.query.attributes && payload.query.attributes.length > 0) {
					return paginatedResults.map((entity) => {
						const result: Partial<T> = {}
						for (const attr of payload.query.attributes) {
							result[attr as keyof T] = entity[attr as keyof T]
						}
						return result as T
					})
				}

				return paginatedResults
			},
			[Method.UPDATE]: async (payload: Payload<T, Method.UPDATE>) => {
				const updatedIds: string[] = []
				for (const entity of pool) {
					if (isEntityMatchingQuery(entity, payload.query) && !entity.deletedAt) {
						const updatedEntity = { ...entity }
						Object.keys(payload.body).forEach((key) => {
							updatedEntity[key] = payload.body[key]
						})

						checkUniqueConstraints(model, updatedEntity as T, pool, entity.id)

						Object.assign(entity, updatedEntity)
						if (entity.id) {
							updatedIds.push(entity.id)
						}
					}
				}
				return updatedIds
			},
			[Method.DELETE]: async (payload: Payload<T, Method.DELETE>) => {
				const deletedIds: string[] = []
				for (const entity of pool) {
					if (isEntityMatchingQuery(entity, payload.query)) {
						if (payload.options.hardDelete === true) {
							const index = pool.indexOf(entity)
							if (index > -1) {
								pool.splice(index, 1)
							}
						} else {
							entity.deletedAt = new Date().toISOString()
						}
						if (entity.id) {
							deletedIds.push(entity.id)
						}
					}
				}
				return deletedIds
			},
		}
	},
}) as Database

function sortEntities<T extends Model>(entities: T[], orderBy: Record<string, "asc" | "desc">) {
	entities.sort((a, b) => {
		for (const [key, direction] of Object.entries(orderBy)) {
			const aValue = a[key]
			const bValue = b[key]

			if (aValue === bValue) continue

			if (aValue === null || aValue === undefined) return direction === "asc" ? -1 : 1
			if (bValue === null || bValue === undefined) return direction === "asc" ? 1 : -1

			const comparison = aValue < bValue ? -1 : 1
			return direction === "asc" ? comparison : -comparison
		}
		return 0
	})
}

export function isEntityMatchingQuery<T extends Model>(entity: T, query: QueryType<T>): boolean {
	const filter = query.filter || {}

	for (const [key, condition] of Object.entries(filter)) {
		const value = entity[key]
		const typedCondition = condition as {
			equals?: unknown
			notEquals?: unknown
			in?: unknown[]
			notIn?: unknown[]
			lt?: number | string | Date
			lte?: number | string | Date
			gt?: number | string | Date
			gte?: number | string | Date
			like?: string
			isNull?: boolean
		}

		if (typedCondition.equals !== undefined && value !== typedCondition.equals) return false
		if (typedCondition.notEquals !== undefined && value === typedCondition.notEquals) return false
		if (typedCondition.in && !typedCondition.in.includes(value)) return false
		if (typedCondition.notIn && typedCondition.notIn.includes(value)) return false
		if (typedCondition.lt !== undefined && (value === null || value >= typedCondition.lt)) return false
		if (typedCondition.lte !== undefined && (value === null || value > typedCondition.lte)) return false
		if (typedCondition.gt !== undefined && (value === null || value <= typedCondition.gt)) return false
		if (typedCondition.gte !== undefined && (value === null || value < typedCondition.gte)) return false
		if (typedCondition.like !== undefined) {
			const pattern = typedCondition.like.replace(/%/g, ".*")
			const regex = new RegExp(`^${pattern}$`)
			if (!regex.test(String(value))) return false
		}
		if (typedCondition.isNull !== undefined && (value === null) !== typedCondition.isNull) return false
	}

	return true
}
