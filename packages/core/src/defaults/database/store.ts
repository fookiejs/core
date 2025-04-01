import { Database } from "../../core/database.ts"
import type { Model, QueryType } from "../../core/model/model.ts"
import { Method } from "../../core/method.ts"
import type { Payload } from "../../core/payload.ts"
import { Utils } from "../../utils/util.ts"
import { types } from "../type/types.ts"

export const store = Database.create({
	key: "store",
	primaryKeyType: types.text,
	modify: function <T extends Model>() {
		const pool: T[] = []
		return {
			[Method.CREATE]: async (payload: Payload<T, Method.CREATE>) => {
				const now = new Date().toISOString()
				payload.body.createdAt = now
				payload.body.updatedAt = now
				pool.push(payload.body)
				return payload.body
			},
			[Method.READ]: async (payload: Payload<T, Method.READ>) => {
				const matchingEntities: T[] = []
				for (const entity of pool) {
					if (isEntityMatchingQuery(entity, payload.query) && !entity.deletedAt) {
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
				for (const entity of pool) {
					if (isEntityMatchingQuery(entity, payload.query) && !entity.deletedAt) {
						Object.keys(payload.body).forEach((key) => {
							;(entity as Record<string, any>)[key] = (
								payload.body as Record<string, any>
							)[key]
						})
					}
				}
				return true
			},
			[Method.DELETE]: async (payload: Payload<T, Method.DELETE>) => {
				for (const entity of pool) {
					if (isEntityMatchingQuery(entity, payload.query)) {
						entity.deletedAt = new Date().toISOString()
					}
				}
				return true
			},
		}
	},
}) as Database

function sortEntities<T extends Model>(entities: T[], orderBy: Partial<Record<keyof T, "asc" | "desc">>): void {
	const orderKeys = Object.keys(orderBy) as Array<keyof T>

	entities.sort((a, b) => {
		for (const key of orderKeys) {
			const direction = orderBy[key] === "desc" ? -1 : 1
			const valueA = a[key]
			const valueB = b[key]

			if (valueA === null && valueB === null) continue
			if (valueA === null) return direction
			if (valueB === null) return -direction

			if (typeof valueA !== typeof valueB) {
				const strA = String(valueA)
				const strB = String(valueB)
				if (strA < strB) return -1 * direction
				if (strA > strB) return 1 * direction
				continue
			}

			if (Utils.isNumber(valueA) && Utils.isNumber(valueB)) {
				return (Number(valueA) - Number(valueB)) * direction
			}

			if (Utils.isString(valueA) && Utils.isString(valueB)) {
				return String(valueA).localeCompare(String(valueB)) * direction
			}

			if (Utils.isTimestamp(valueA) && Utils.isTimestamp(valueB)) {
				const dateA = new Date(valueA as string | number | Date).getTime()
				const dateB = new Date(valueB as string | number | Date).getTime()
				return (dateA - dateB) * direction
			}

			if (Utils.isBoolean(valueA) && Utils.isBoolean(valueB)) {
				return ((valueA === valueB) ? 0 : (valueA ? 1 : -1)) * direction
			}
		}

		return 0
	})
}

function isEntityMatchingQuery<T extends Model>(
	entity: T,
	query: QueryType<T>,
): boolean {
	if (!query.filter) {
		return true
	}

	for (const field of Object.keys(query.filter) as Array<keyof T>) {
		const condition = query.filter[field]
		if (!condition) continue

		const entityValue = entity[field]

		if (condition.equals !== undefined && entityValue !== condition.equals) {
			return false
		}

		if (condition.notEquals !== undefined && entityValue === condition.notEquals) {
			return false
		}

		if (condition.in && !condition.in.includes(entityValue as never)) {
			return false
		}
		if (condition.notIn && condition.notIn.includes(entityValue as never)) {
			return false
		}
		if (condition.lt !== undefined && entityValue >= condition.lt) {
			return false
		}
		if (condition.lte !== undefined && entityValue > condition.lte) {
			return false
		}
		if (condition.gt !== undefined && entityValue <= condition.gt) {
			return false
		}
		if (condition.gte !== undefined && entityValue < condition.gte) {
			return false
		}
		if (
			condition.like &&
			!new RegExp(condition.like.replace(/%/g, ".*")).test(
				String(entityValue),
			)
		) {
			return false
		}
		if (Utils.isBoolean(condition.isNull)) {
			if (condition.isNull && entityValue !== null) {
				return false
			}
			if (!condition.isNull && entityValue === null) {
				return false
			}
		}
	}

	return true
}
