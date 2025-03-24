import { Database } from "../../core/database.ts"
import type { Model, QueryType } from "../../core/model/model.ts"
import { Method } from "../../core/method.ts"
import type { Payload } from "../../core/payload.ts"
import { Utils } from "../../utils/util.ts"
import { types } from "../type/types.ts"

export const store = Database.create({
	key: "store",
	connect: async function () {
		return
	},
	primaryKeyType: types.text,
	disconnect: async function () {
		return
	},
	modify: function <T extends Model>() {
		let pool: T[] = []
		return {
			[Method.CREATE]: async (payload: Payload<T, Method.CREATE>) => {
				pool.push(payload.body)
				return payload.body
			},
			[Method.READ]: async (payload: Payload<T, Method.READ>) => {
				const attributes = payload.query.attributes
				const matchingEntities: T[] = []

				for (const entity of pool) {
					if (isEntityMatchingQuery(entity, payload.query)) {
						matchingEntities.push(entity)
					}
				}

				const start = payload.query.offset || 0
				const end = start + (payload.query.limit || matchingEntities.length)
				const paginatedResults = matchingEntities.slice(start, end)

				return paginatedResults.map((entity) => {
					const result: Partial<T> = {}
					for (const attr of attributes) {
						result[attr as keyof T] = entity[attr as keyof T]
					}
					return result as T
				})
			},
			[Method.UPDATE]: async (payload: Payload<T, Method.UPDATE>) => {
				for (const entity of pool) {
					if (isEntityMatchingQuery(entity, payload.query)) {
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
				const newPool: T[] = []

				for (const entity of pool) {
					if (!isEntityMatchingQuery(entity, payload.query)) {
						newPool.push(entity)
					}
				}

				pool = newPool
				return true
			},
		}
	},
}) as Database

function isEntityMatchingQuery<T extends Model>(
	entity: T,
	query: QueryType<T>,
): boolean {
	if (!query.filter) {
		return true
	}

	for (const field of Object.keys(query.filter) as Array<keyof T>) {
		const value = query.filter[field]!
		const entityValue = entity[field]

		if (value.equals !== undefined && entityValue !== value.equals) {
			return false
		}

		if (value.notEquals !== undefined && entityValue === value.notEquals) {
			return false
		}

		if (value.in && !value.in.includes(entityValue as never)) {
			return false
		}
		if (value.notIn && value.notIn.includes(entityValue as never)) {
			return false
		}
		if (value.lt !== undefined && entityValue >= value.lt) {
			return false
		}
		if (value.lte !== undefined && entityValue > value.lte) {
			return false
		}
		if (value.gt !== undefined && entityValue <= value.gt) {
			return false
		}
		if (value.gte !== undefined && entityValue < value.gte) {
			return false
		}
		if (
			value.like &&
			!new RegExp(value.like.replace(/%/g, ".*")).test(
				entityValue as string,
			)
		) {
			return false
		}
		if (Utils.isBoolean(value.isNull)) {
			if (value.isNull && entityValue !== null) {
				return false
			}
			if (!value.isNull && entityValue === null) {
				return false
			}
		}
	}

	return true
}
