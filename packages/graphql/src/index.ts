import { Method, Model, models, TypeStandartization } from "@fookiejs/core"
import { FookieDataLoader } from "./dataloader.ts"
import { MutationField, QueryField, Resolvers, SubscriptionField, TypeDefs, TypeField } from "./types.ts"
import { PubSub } from "npm:graphql-subscriptions@2.0.0"
import { CoreTypes } from "@fookiejs/core"

const pubsub = new PubSub()

let resolveRooms: ((token: string) => Promise<string[]>) | null = null

export function setResolveRooms(resolver: (token: string) => Promise<string[]>) {
	resolveRooms = resolver
}

function generate_filter_types(): string {
	let result = ""

	for (const [typeName, typeConfig] of Object.entries(CoreTypes)) {
		if (!typeConfig.queryController || Object.keys(typeConfig.queryController).length === 0) continue

		const graphqlType = resolve_type({ type: typeName })
		const filterName = `${graphqlType}_filter`

		const fields = Object.entries(typeConfig.queryController)
			.map(([operatorName, operatorConfig]) => {
				const fieldType = operatorConfig.isArray ? `[${graphqlType}]` : graphqlType
				return `  ${operatorName}: ${fieldType}`
			})
			.join("\n")

		if (fields) {
			result += `input ${filterName} {\n${fields}\n}\n\n`
		}
	}

	return result
}

const filter_types = generate_filter_types()

function resolve_type(field: any): string {
	if (!field?.type) return "String"

	const type = field.type
	if (type.relation) {
		return type.relation.getName()
	}

	switch (type) {
		case TypeStandartization.String:
			return "String"
		case TypeStandartization.Integer:
			return "Int"
		case TypeStandartization.Float:
			return "Float"
		case TypeStandartization.Boolean:
			return "Boolean"
		case TypeStandartization.Date:
		case TypeStandartization.DateTime:
		case TypeStandartization.Timestamp:
			return "DateTime"
		case TypeStandartization.UUID:
			return "ID"
		default:
			return "String"
	}
}

function resolve_input(field: any): string {
	if (!field?.field?.type) return "String_filter"

	const type = field.field.type
	if (type.relation) {
		return `${type.relation.getName()}_filter`
	}

	const resolvedType = resolve_type({ type })
	const coreType = CoreTypes[type]

	if (!coreType?.queryController || Object.keys(coreType.queryController).length === 0) {
		return "String_filter"
	}

	return `${resolvedType}_filter`
}

function generate_model_filter(model: typeof Model, fields: Record<string, TypeField>): string {
	const filterFields = Object.entries(fields)
		.map(([key, field]) => {
			const type = field.field?.type
			if (!type) return null

			const coreType = CoreTypes[type]
			if (!coreType?.queryController || Object.keys(coreType.queryController).length === 0) {
				return null
			}

			return `  ${key}: ${resolve_input(field)}`
		})
		.filter(Boolean)
		.join("\n")

	if (!filterFields) return ""

	return `input ${model.getName()}_filter {\n${filterFields}\n}`
}

export function publishEvent(roomId: string, model: typeof Model, method: Method, data: any) {
	const modelName = model.getName()
	const eventName = `${modelName}_${method}.${roomId}`
	pubsub.publish(eventName, data)
}

export function createTypeDefs(): { typeDefs: string } {
	const typeDefs: TypeDefs = {
		input: {},
		type: {},
		Query: {},
		Mutation: {},
		Subscription: {},
	}

	for (const model of models) {
		const modelName = model.getName()

		const modelFields: Record<string, TypeField> = {
			id: { value: TypeStandartization.String, is_pk: true },
		}

		Object.entries((model as any).fields).forEach(([key, field]) => {
			modelFields[key] = {
				value: resolve_type(field),
				field: field,
				operations: {
					equals: true,
					notEquals: true,
					in: true,
					notIn: true,
					isNull: true,
				},
			}
		})

		typeDefs.type[modelName] = modelFields

		typeDefs.type[`${modelName}UpdatePayload`] = {
			ids: { value: "[ID!]!" as TypeStandartization },
			body: { value: modelName },
		}

		typeDefs.type[`${modelName}DeletePayload`] = {
			ids: { value: "[ID!]!" as TypeStandartization },
		}

		typeDefs.Query[modelName] = {
			value: modelName,
			args: {
				filter: { value: `${modelName}WhereInput` },
				limit: { value: TypeStandartization.Integer },
				offset: { value: TypeStandartization.Integer },
				orderBy: { value: `${modelName}OrderByInput` },
			},
		} as QueryField

		typeDefs.Query[`${modelName}s`] = {
			value: `[${modelName}]`,
			args: {
				filter: { value: `${modelName}WhereInput` },
				limit: { value: TypeStandartization.Integer },
				offset: { value: TypeStandartization.Integer },
				orderBy: { value: `${modelName}OrderByInput` },
			},
		} as QueryField

		typeDefs.Mutation[`create${modelName}`] = {
			value: modelName,
			args: {
				data: { value: `${modelName}CreateInput` },
			},
		} as MutationField

		typeDefs.Mutation[`update${modelName}`] = {
			value: `${modelName}UpdatePayload`,
			args: {
				where: { value: `${modelName}WhereInput` },
				data: { value: `${modelName}UpdateInput` },
			},
		} as MutationField

		typeDefs.Mutation[`delete${modelName}`] = {
			value: `${modelName}DeletePayload`,
			args: {
				where: { value: `${modelName}WhereInput` },
			},
		} as MutationField

		typeDefs.Subscription[`${modelName}Created`] = {
			value: modelName,
		} as SubscriptionField

		typeDefs.Subscription[`${modelName}Updated`] = {
			value: `${modelName}UpdatePayload`,
		} as SubscriptionField

		typeDefs.Subscription[`${modelName}Deleted`] = {
			value: `${modelName}DeletePayload`,
		} as SubscriptionField

		typeDefs.input[`${modelName}WhereInput`] = modelFields
		typeDefs.input[`${modelName}CreateInput`] = modelFields
		typeDefs.input[`${modelName}UpdateInput`] = modelFields
		typeDefs.input[`${modelName}OrderByInput`] = Object.fromEntries(
			Object.keys(modelFields).map((key) => [key, { value: "OrderByEnum" }]),
		)
	}

	const typeDefsString = generateTypeDefsString(typeDefs)
	return { typeDefs: typeDefsString }
}

function generateTypeDefsString(typeDefs: TypeDefs): string {
	let result = "scalar DateTime\n\n"
	result += "enum OrderByEnum {\n  ASC\n  DESC\n}\n\n"

	Object.entries(typeDefs.type).forEach(([typeName, fields]) => {
		result += `type ${typeName} {\n`
		Object.entries(fields).forEach(([fieldName, field]) => {
			result += `  ${fieldName}: ${field.value}\n`
		})
		result += "}\n\n"
	})

	Object.entries(typeDefs.input).forEach(([inputName, fields]) => {
		result += `input ${inputName} {\n`
		Object.entries(fields).forEach(([fieldName, field]) => {
			result += `  ${fieldName}: ${field.value}\n`
		})
		result += "}\n\n"
	})

	result += "type Query {\n"
	Object.entries(typeDefs.Query).forEach(([queryName, field]) => {
		const args = field.args
			? `(${Object.entries(field.args).map(([name, arg]) => `${name}: ${arg.value}`).join(", ")})`
			: ""
		result += `  ${queryName}${args}: ${field.value}\n`
	})
	result += "}\n\n"

	result += "type Mutation {\n"
	Object.entries(typeDefs.Mutation).forEach(([mutationName, field]) => {
		const args = field.args
			? `(${Object.entries(field.args).map(([name, arg]) => `${name}: ${arg.value}`).join(", ")})`
			: ""
		result += `  ${mutationName}${args}: ${field.value}\n`
	})
	result += "}\n\n"

	result += "type Subscription {\n"
	Object.entries(typeDefs.Subscription).forEach(([subscriptionName, field]) => {
		result += `  ${subscriptionName}: ${field.value}\n`
	})
	result += "}\n"

	return result
}

export function createContext(req: any): { token: string } {
	const token = req.headers.authorization?.replace("Bearer ", "") || ""
	return { token }
}

export function createResolvers(): { resolvers: Resolvers } {
	const resolvers: Resolvers = {
		Query: {},
		Mutation: {},
		Subscription: {},
	}

	for (const model of models) {
		const modelName = model.getName()

		resolvers.Subscription[`${modelName}Created`] = {
			subscribe: async (_, __, context) => {
				if (!context?.token) throw new Error("Unauthorized")
				if (!resolveRooms) throw new Error("ResolveRooms hook not set")

				const rooms = await resolveRooms(context.token)
				if (!rooms.length) throw new Error("No rooms available")

				const eventNames = rooms.map((room) => `${modelName}_${Method.CREATE}.${room}`)
				return pubsub.asyncIterator(eventNames)
			},
			resolve: (payload) => payload,
		}

		resolvers.Subscription[`${modelName}Updated`] = {
			subscribe: async (_, __, context) => {
				if (!context?.token) throw new Error("Unauthorized")
				if (!resolveRooms) throw new Error("ResolveRooms hook not set")

				const rooms = await resolveRooms(context.token)
				if (!rooms.length) throw new Error("No rooms available")

				const eventNames = rooms.map((room) => `${modelName}_${Method.UPDATE}.${room}`)
				return pubsub.asyncIterator(eventNames)
			},
			resolve: (payload) => {
				if (!payload.ids || !payload.body) {
					throw new Error("Invalid update payload")
				}
				return { ids: payload.ids, body: payload.body }
			},
		}

		resolvers.Subscription[`${modelName}Deleted`] = {
			subscribe: async (_, __, context) => {
				if (!context?.token) throw new Error("Unauthorized")
				if (!resolveRooms) throw new Error("ResolveRooms hook not set")

				const rooms = await resolveRooms(context.token)
				if (!rooms.length) throw new Error("No rooms available")

				const eventNames = rooms.map((room) => `${modelName}_${Method.DELETE}.${room}`)
				return pubsub.asyncIterator(eventNames)
			},
			resolve: (payload) => {
				if (!payload.ids) {
					throw new Error("Invalid delete payload")
				}
				return { ids: payload.ids }
			},
		}
	}

	return { resolvers }
}

export function createGraphQL(): { typeDefs: string; resolvers: Resolvers } {
	const typeDefs: TypeDefs = {
		input: {},
		type: {},
		Query: {},
		Mutation: {},
		Subscription: {},
	}

	const resolvers: Resolvers = {
		Query: {},
		Mutation: {},
		Subscription: {},
		DateTime: {
			serialize: (value: any) => {
				if (value instanceof Date) {
					return value.toISOString()
				}
				return value
			},
			parseValue: (value: any) => {
				return new Date(value)
			},
		},
	}

	// First pass: Create basic types and resolvers
	for (const model of models) {
		if (model.getName() === "Query") {
			throw Error("Model name can not be 'Query'")
		}

		const modelName = model.getName()
		const schema = model.schema()

		const typeFields: Record<string, TypeField> = {
			id: { value: "ID", field: { type: TypeStandartization.UUID } } as TypeField,
		}

		// Add regular fields and relation entity fields
		Object.entries(schema).forEach(([key, field]: [string, any]) => {
			typeFields[key] = { value: resolve_type(field), field } as TypeField

			if (field.relation) {
				typeFields[`${key}_entity`] = {
					value: field.relation.getName(),
				} as TypeField

				if (!resolvers[modelName]) {
					resolvers[modelName] = {}
				}

				resolvers[modelName][`${key}_entity`] = async (parent: any, _: any, context: any) => {
					if (!parent[key]) return null
					try {
						const relatedModel = field.relation
						const results = await relatedModel.read(
							{ filter: { id: { equals: parent[key] } } },
							{ token: context.token || "" },
						)
						return Array.isArray(results) && results.length > 0 ? results[0] : null
					} catch (error) {
						console.error("RELATION ERROR:", error)
						return null
					}
				}
			}
		})

		typeDefs.type[modelName] = typeFields

		typeDefs.type[`${modelName}UpdatePayload`] = {
			ids: { value: "[ID!]!" },
			body: { value: modelName },
		}

		typeDefs.type[`${modelName}DeletePayload`] = {
			ids: { value: "[ID!]!" },
		}

		typeDefs.input[`${modelName}_input`] = Object.fromEntries(
			Object.entries(schema)
				.filter(([key]) => key !== "id")
				.map(([key, field]) => [
					key,
					{ value: resolve_type(field), field } as TypeField,
				]),
		)

		typeDefs.Query[modelName] = { value: `[${modelName}]` }

		resolvers.Query[modelName] = async (_: any, { query = {} }: any, context: any) => {
			const token = context.token || ""
			const response = await model.read(query, { token })
			return Array.isArray(response) ? response : []
		}

		// Add subscription fields and resolvers
		typeDefs.Subscription[`${modelName}Created`] = {
			value: modelName,
		} as SubscriptionField

		typeDefs.Subscription[`${modelName}Updated`] = {
			value: `${modelName}UpdatePayload`,
		} as SubscriptionField

		typeDefs.Subscription[`${modelName}Deleted`] = {
			value: `${modelName}DeletePayload`,
		} as SubscriptionField

		resolvers.Subscription[`${modelName}Created`] = {
			subscribe: async (_, __, context) => {
				if (!context?.token) throw new Error("Unauthorized")
				if (!resolveRooms) throw new Error("ResolveRooms hook not set")

				const rooms = await resolveRooms(context.token)
				if (!rooms.length) throw new Error("No rooms available")

				const eventNames = rooms.map((room) => `${modelName}_${Method.CREATE}.${room}`)
				return pubsub.asyncIterator(eventNames)
			},
			resolve: (payload) => payload,
		}

		resolvers.Subscription[`${modelName}Updated`] = {
			subscribe: async (_, __, context) => {
				if (!context?.token) throw new Error("Unauthorized")
				if (!resolveRooms) throw new Error("ResolveRooms hook not set")

				const rooms = await resolveRooms(context.token)
				if (!rooms.length) throw new Error("No rooms available")

				const eventNames = rooms.map((room) => `${modelName}_${Method.UPDATE}.${room}`)
				return pubsub.asyncIterator(eventNames)
			},
			resolve: (payload) => {
				if (!payload.ids || !payload.body) {
					throw new Error("Invalid update payload")
				}
				return { ids: payload.ids, body: payload.body }
			},
		}

		resolvers.Subscription[`${modelName}Deleted`] = {
			subscribe: async (_, __, context) => {
				if (!context?.token) throw new Error("Unauthorized")
				if (!resolveRooms) throw new Error("ResolveRooms hook not set")

				const rooms = await resolveRooms(context.token)
				if (!rooms.length) throw new Error("No rooms available")

				const eventNames = rooms.map((room) => `${modelName}_${Method.DELETE}.${room}`)
				return pubsub.asyncIterator(eventNames)
			},
			resolve: (payload) => {
				if (!payload.ids) {
					throw new Error("Invalid delete payload")
				}
				return { ids: payload.ids }
			},
		}

		// Add mutation resolvers
		resolvers.Mutation = {
			...resolvers.Mutation,
			[`create_${modelName}`]: async (_: any, { body }: any, context: any) => {
				return await model.create(body, { token: context.token || "" })
			},
			[`update_${modelName}`]: async (_: any, { query, body }: any, context: any) => {
				await model.update(query || {}, body, { token: context.token || "" })
				return true
			},
			[`delete_${modelName}`]: async (_: any, { query }: any, context: any) => {
				await model.delete(query || {}, { token: context.token || "" })
				return true
			},
			[`count_${modelName}`]: async (_: any, { query }: any, context: any) => {
				const items = await model.read(query || {}, { token: context.token || "" })
				return Array.isArray(items) ? items.length : 0
			},
			[`sum_${modelName}`]: async (_: any, { query, field }: any, context: any) => {
				if (!field) return 0
				const items = await model.read(query || {}, { token: context.token || "" })
				return Array.isArray(items) ? items.reduce((total, item: any) => total + (Number(item[field]) || 0), 0) : 0
			},
		}
	}

	// Second pass: Add relation-based fields (all_, sum_, count_)
	for (const model of models) {
		const schema = model.schema()

		Object.entries(schema).forEach(([field, fieldConfig]: [string, any]) => {
			if (fieldConfig.relation) {
				const relatedModel = fieldConfig.relation
				const relatedModelName = relatedModel.getName()

				if (!typeDefs.type[relatedModelName]) return

				// Add all_ field
				typeDefs.type[relatedModelName][`all_${model.getName()}`] = {
					value: `[${model.getName()}]`,
					args: {
						query: { value: `${model.getName()}_query` },
					},
				}

				// Add sum_ field
				typeDefs.type[relatedModelName][`sum_${model.getName()}`] = {
					value: "Float",
					args: {
						query: { value: `${model.getName()}_query` },
						field: { value: "String" },
					},
				}

				// Add count_ field
				typeDefs.type[relatedModelName][`count_${model.getName()}`] = {
					value: "Int",
					args: {
						query: { value: `${model.getName()}_query` },
					},
				}

				if (!resolvers[relatedModelName]) {
					resolvers[relatedModelName] = {}
				}

				// Add resolver for all_
				resolvers[relatedModelName][`all_${model.getName()}`] = async (
					parent: any,
					{ query = {} }: any,
					context: any,
				) => {
					const queryObj = { ...query }
					if (!queryObj.filter) {
						queryObj.filter = {}
					}
					queryObj.filter[field] = { equals: parent.id }

					const response = await model.read(queryObj, { token: context.token || "" })
					return Array.isArray(response) ? response : []
				}

				// Add resolver for sum_
				resolvers[relatedModelName][`sum_${model.getName()}`] = async (
					parent: any,
					{ query = {}, field: sumField }: any,
					context: any,
				) => {
					if (!sumField) return 0

					const queryObj = { ...query }
					if (!queryObj.filter) {
						queryObj.filter = {}
					}
					queryObj.filter[field] = { equals: parent.id }

					const items = await model.read(queryObj, { token: context.token || "" })
					return Array.isArray(items) ? items.reduce((total, item: any) => total + (Number(item[sumField]) || 0), 0) : 0
				}

				// Add resolver for count_
				resolvers[relatedModelName][`count_${model.getName()}`] = async (
					parent: any,
					{ query = {} }: any,
					context: any,
				) => {
					const queryObj = { ...query }
					if (!queryObj.filter) {
						queryObj.filter = {}
					}
					queryObj.filter[field] = { equals: parent.id }

					const items = await model.read(queryObj, { token: context.token || "" })
					return Array.isArray(items) ? items.length : 0
				}
			}
		})
	}

	const schemaString = `
scalar DateTime

${filter_types}

${
		models.map((model) => {
			const modelName = model.getName()
			const fields = Object.entries(typeDefs.type[modelName] || {})
				.map(([key, field]) => {
					if (field.args) {
						const args = Object.entries(field.args)
							.map(([argName, arg]) => `${argName}: ${arg.value}`)
							.join(", ")
						return `  ${key}(${args}): ${field.value}`
					}
					return `  ${key}: ${field.value}`
				})
				.join("\n")

			const updatePayloadFields = Object.entries(typeDefs.type[`${modelName}UpdatePayload`] || {})
				.map(([key, value]) => `  ${key}: ${value.value}`)
				.join("\n")

			const deletePayloadFields = Object.entries(typeDefs.type[`${modelName}DeletePayload`] || {})
				.map(([key, value]) => `  ${key}: ${value.value}`)
				.join("\n")

			const modelFilter = generate_model_filter(model, typeDefs.type[modelName] || {})

			return `type ${modelName} {\n${fields}\n}

type ${modelName}UpdatePayload {\n${updatePayloadFields}\n}

type ${modelName}DeletePayload {\n${deletePayloadFields}\n}

${modelFilter}`
		}).join("\n\n")
	}

type Query {
${
		Object.entries(typeDefs.Query)
			.map(([key]) => `  ${key}(query: ${key}_query): ${typeDefs.Query[key].value}`)
			.join("\n")
	}
}

type Mutation {
${
		models.map((model) => {
			const modelName = model.getName()
			return `  create_${modelName}(body: ${modelName}_input): ${modelName}
  update_${modelName}(query: ${modelName}_query, body: ${modelName}_input): Boolean
  delete_${modelName}(query: ${modelName}_query): Boolean
  count_${modelName}(query: ${modelName}_query): Int
  sum_${modelName}(query: ${modelName}_query, field: String): Float`
		}).join("\n")
	}
}

${
		models.map((model) => {
			const modelName = model.getName()
			return `input ${modelName}_query {
  offset: Int
  limit: Int
  filter: ${modelName}_filter
}

input ${modelName}_input {
${
				Object.entries(typeDefs.input[`${modelName}_input`] || {})
					.map(([key, value]) => `  ${key}: ${value.value}`)
					.join("\n")
			}
}`
		}).join("\n\n")
	}

type Subscription {
${
		Object.entries(typeDefs.Subscription)
			.map(([key, field]) => `  ${key}: ${field.value}`)
			.join("\n")
	}
}
`

	return {
		typeDefs: schemaString,
		resolvers,
	}
}

export function createDataLoader(token: string = ""): FookieDataLoader {
	return new FookieDataLoader(async (model: any, ids) => {
		const response = await model.read(
			{
				filter: {
					id: { in: ids },
				},
			},
			{ token },
		)
		return Array.isArray(response) ? response : []
	})
}
