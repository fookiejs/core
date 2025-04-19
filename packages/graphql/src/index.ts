import { defaults, Method, Model, models, TypeStandartization } from "@fookiejs/core"
import { FookieDataLoader } from "./dataloader.ts"
import {
	AsyncIteratorLike,
	MutationField,
	QueryField,
	Resolvers,
	SubscriptionField,
	TypeDefs,
	TypeField,
} from "./types.ts"
import { PubSub } from "npm:graphql-subscriptions@2.0.0"
import { CoreTypes } from "../../core/src/defaults/type/types.ts"

const pubsub = new PubSub()

class AsyncIteratorWrapper<T> implements AsyncIteratorLike<T> {
	constructor(private iterator: AsyncIterator<T>) {}

	async next(): Promise<{ value: T; done: boolean }> {
		const result = await this.iterator.next()
		return {
			value: result.value as T,
			done: result.done ?? false,
		}
	}

	async return?(value?: T): Promise<{ value: T; done: boolean }> {
		const result = await this.iterator.return?.(value as any)
		return {
			value: result?.value as T,
			done: true,
		}
	}

	async throw?(error: any): Promise<{ value: T; done: boolean }> {
		const result = await this.iterator.throw?.(error)
		return {
			value: result?.value as T,
			done: true,
		}
	}
}

let resolveRooms: ((token: string) => Promise<string[]>) | null = null

export function setResolveRooms(resolver: (token: string) => Promise<string[]>) {
	resolveRooms = resolver
}

const graphqlNativeTypes = ["String", "Int", "Float", "Boolean", "ID"]

const filterTypeMap: Record<string, string> = {
	"String": "string_filter",
	"Int": "int_filter",
	"Float": "float_filter",
	"Boolean": "boolean_filter",
}

function generate_filter_types(): string {
	const fookieTypes = Object.values(CoreTypes)
		.filter((t) => typeof t === "object" && t !== null && "key" in t && "queryController" in t)

	let result = ""

	const filterableTypes = graphqlNativeTypes.filter((type) => type !== "ID")

	const typeMapping = {
		"String": fookieTypes.filter((t) => resolve_type({ type: t }) === "String")[0],
		"Int": fookieTypes.filter((t) => resolve_type({ type: t }) === "Int")[0],
		"Float": fookieTypes.filter((t) => resolve_type({ type: t }) === "Float")[0],
		"Boolean": fookieTypes.filter((t) => resolve_type({ type: t }) === "Boolean")[0],
		"DateTime": fookieTypes.filter((t) => resolve_type({ type: t }) === "DateTime")[0],
	}

	const filterConfigs = filterableTypes.map((graphqlType) => {
		const name = graphqlType.toLowerCase() + "_filter"
		const fookieType = typeMapping[graphqlType]
		const fields = []

		fields.push({ name: "isNull", type: "Boolean" })

		if (fookieType && fookieType.queryController && Object.keys(fookieType.queryController).length > 0) {
			for (const opName of Object.keys(fookieType.queryController)) {
				if (opName === "isNull") continue
				const validator = fookieType.queryController[opName]
				if (validator && typeof validator === "object" && validator.isArray) {
					fields.push({ name: opName, type: `[${graphqlType}]` })
				} else {
					fields.push({ name: opName, type: graphqlType })
				}
			}
		} else {
			fields.push({ name: "equals", type: graphqlType })
			fields.push({ name: "notEquals", type: graphqlType })
		}

		return {
			name,
			baseType: graphqlType,
			fields,
		}
	})

	for (const config of filterConfigs) {
		result += `input ${config.name} {\n`
		for (const field of config.fields) {
			result += `  ${field.name}: ${field.type}\n`
		}
		result += `}\n\n`
	}

	return result.trim()
}

const filter_types = generate_filter_types()

function resolve_type(field: any): TypeStandartization | string {
	if (!field || !field.type) return TypeStandartization.String

	if (field.type && field.type.key) {
		const key = field.type.key.toLowerCase()
		const aliases = field.type.alias || []

		if (key.includes("[]")) {
			return `[${resolve_type({ type: { key: key.replace("[]", "") } })}]`
		}

		for (const graphqlType of graphqlNativeTypes) {
			const lowerGraphqlType = graphqlType.toLowerCase()
			if (key.includes(lowerGraphqlType) || aliases.some((a) => a.toLowerCase().includes(lowerGraphqlType))) {
				return graphqlType as TypeStandartization
			}
		}

		if (key.includes("date") || key.includes("timestamp") || aliases.some((a) => a.toLowerCase().includes("date"))) {
			return TypeStandartization.DateTime
		}
	}

	return TypeStandartization.String
}

function resolve_input(typeStr: string, field: any = null): string {
	if (!typeStr) return "string_filter"

	if (field && field.field && field.field.type && field.field.type.queryController) {
		const queryController = field.field.type.queryController
		const queryControllerKeys = Object.keys(queryController)

		if (queryControllerKeys.length > 0) {
			const resolvedType = resolve_type(field.field)
			if (filterTypeMap[resolvedType]) {
				return filterTypeMap[resolvedType]
			}
		}
	}

	if (filterTypeMap[typeStr]) {
		return filterTypeMap[typeStr]
	}

	if (typeStr && typeStr.startsWith("[") && typeStr.endsWith("]")) {
		const innerType = typeStr.substring(1, typeStr.length - 1)
		return resolve_input(innerType)
	}

	return "string_filter"
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

export function createContext(req: any) {
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
				return new AsyncIteratorWrapper(pubsub.asyncIterator(eventNames))
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
				return new AsyncIteratorWrapper(pubsub.asyncIterator(eventNames))
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
				return new AsyncIteratorWrapper(pubsub.asyncIterator(eventNames))
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

export function createGraphQL() {
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

	for (const model of models) {
		if (model.getName() === "Query") {
			throw Error("Model name can not be 'Query'")
		}

		const modelName = model.getName()
		const schema = model.schema()

		typeDefs.type[modelName] = {
			id: { value: "ID" } as TypeField,
			...Object.fromEntries(
				Object.entries(schema).map(([key, field]) => [
					key,
					{ value: resolve_type(field) } as TypeField,
				]),
			),
		}

		typeDefs.type[`${modelName}UpdatePayload`] = {
			ids: { value: "[ID!]!" },
			body: { value: modelName },
		}

		typeDefs.type[`${modelName}DeletePayload`] = {
			ids: { value: "[ID!]!" },
		}

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
				return new AsyncIteratorWrapper(pubsub.asyncIterator(eventNames))
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
				return new AsyncIteratorWrapper(pubsub.asyncIterator(eventNames))
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
				return new AsyncIteratorWrapper(pubsub.asyncIterator(eventNames))
			},
			resolve: (payload) => {
				if (!payload.ids) {
					throw new Error("Invalid delete payload")
				}
				return { ids: payload.ids }
			},
		}

		typeDefs.input[`${modelName}_input`] = Object.fromEntries(
			Object.entries(schema)
				.filter(([key]) => key !== "id")
				.map(([key, field]) => [
					key,
					{ value: resolve_type(field) } as TypeField,
				]),
		)

		typeDefs.Query[modelName] = { value: `[${modelName}]` }

		resolvers.Query[modelName] = async (_: any, { query = {} }: any, context: any) => {
			const token = context.token || ""
			const response = await model.read(query, { token })
			return Array.isArray(response) ? response : []
		}

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

	const schemaString = `
scalar DateTime

${filter_types}

${
		models.map((model) => {
			const modelName = model.getName()
			const fields = Object.entries(typeDefs.type[modelName] || {})
				.map(([key, value]) => `  ${key}: ${value.value}`)
				.join("\n")

			const updatePayloadFields = Object.entries(typeDefs.type[`${modelName}UpdatePayload`] || {})
				.map(([key, value]) => `  ${key}: ${value.value}`)
				.join("\n")

			const deletePayloadFields = Object.entries(typeDefs.type[`${modelName}DeletePayload`] || {})
				.map(([key, value]) => `  ${key}: ${value.value}`)
				.join("\n")

			return `type ${modelName} {\n${fields}\n}

type ${modelName}UpdatePayload {\n${updatePayloadFields}\n}

type ${modelName}DeletePayload {\n${deletePayloadFields}\n}`
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
			return `input ${modelName}_filter {
${
				Object.entries(typeDefs.type[modelName] || {})
					.map(([key, value]) => `  ${key}: ${resolve_input(value.value)}`)
					.join("\n")
			}
}

input ${modelName}_query {
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
