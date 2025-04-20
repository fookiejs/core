import { Database } from "../../database/database.ts"
import { Model } from "../../model/model.ts"
import { Method } from "../../method/method.ts"
import { Payload } from "../../payload/payload.ts"

import { defaults } from "../index.ts"
import { Utils } from "../../utils/util.ts"
import { TypeStandartization } from "../../type/standartization.ts"
import { QueryType } from "../../query/query.ts"
function checkUniqueConstraints<T extends Model>(
	model: typeof Model,
	entity: T,
	pool: T[],
	excludeId?: string,
): boolean {
	const schema = model.schema()
	for (const [field, fieldSchema] of Utils.entries(schema)) {
		if (fieldSchema.features.includes(defaults.feature.unique)) {
			const value = entity[field]
			const existingEntity = pool.find((e) =>
				e[field] === value &&
				e.deletedAt === null &&
				(!excludeId || e.id !== excludeId)
			)
			if (existingEntity) {
				throw new Error(`Unique constraint violation: ${String(field)} must be unique`)
			}
		}
	}
	return true
}
export const store = Database.create({
	key: "store",
	primaryKeyType: TypeStandartization.String,
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

		// Handle null values first
		if (typedCondition.isNull !== undefined) {
			if ((value === null || value === undefined) !== typedCondition.isNull) {
				return false
			}
			continue
		}

		// Skip other checks if value is null/undefined
		if (value === null || value === undefined) {
			return false
		}

		if (typedCondition.equals !== undefined && value !== typedCondition.equals) return false
		if (typedCondition.notEquals !== undefined && value === typedCondition.notEquals) return false

		if (typedCondition.in && !typedCondition.in.includes(value)) return false
		if (typedCondition.notIn && typedCondition.notIn.includes(value)) return false

		// Date and Number comparisons
		if (
			typedCondition.lt !== undefined || typedCondition.lte !== undefined ||
			typedCondition.gt !== undefined || typedCondition.gte !== undefined
		) {
			let compareValue = value
			let compareCondition = typedCondition

			// Convert dates to timestamps for comparison
			if (value instanceof Date || (typeof value === "string" && !isNaN(Date.parse(value)))) {
				compareValue = new Date(value).getTime()
				if (typedCondition.lt) compareCondition.lt = new Date(typedCondition.lt).getTime()
				if (typedCondition.lte) compareCondition.lte = new Date(typedCondition.lte).getTime()
				if (typedCondition.gt) compareCondition.gt = new Date(typedCondition.gt).getTime()
				if (typedCondition.gte) compareCondition.gte = new Date(typedCondition.gte).getTime()
			}

			if (compareCondition.lt !== undefined && compareValue >= compareCondition.lt) return false
			if (compareCondition.lte !== undefined && compareValue > compareCondition.lte) return false
			if (compareCondition.gt !== undefined && compareValue <= compareCondition.gt) return false
			if (compareCondition.gte !== undefined && compareValue < compareCondition.gte) return false
		}

		// Like operator
		if (typedCondition.like !== undefined) {
			const stringValue = String(value)
			const pattern = typedCondition.like
				.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&") // Escape regex special chars
				.replace(/%/g, ".*") // Convert SQL LIKE to regex pattern

			try {
				const regex = new RegExp(pattern, "i") // Case insensitive
				if (!regex.test(stringValue)) {
					return false
				}
			} catch (error) {
				console.error("Invalid regex pattern:", error)
				return false
			}
		}
	}

	return true
}
