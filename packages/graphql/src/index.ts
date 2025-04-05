import { defaults, Method, Model, models } from "@fookiejs/core"
import { FookieDataLoader } from "./dataloader.ts"
import { Resolvers, TypeDefs, TypeField } from "./types.ts"
import { PubSub } from "npm:graphql-subscriptions@2.0.0"

const pubsub = new PubSub()

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
	"DateTime": "date_filter",
}

function generate_filter_types(): string {
	const fookieTypes = Object.values(defaults.type)
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

function resolve_type(field: any): string {
	if (!field || !field.type) return "String"

	if (field.type && field.type.key) {
		const key = field.type.key.toLowerCase()
		const aliases = field.type.alias || []

		if (key.includes("[]")) {
			return `[${resolve_type({ type: { key: key.replace("[]", "") } })}]`
		}

		for (const graphqlType of graphqlNativeTypes) {
			const lowerGraphqlType = graphqlType.toLowerCase()
			if (key.includes(lowerGraphqlType) || aliases.some((a) => a.toLowerCase().includes(lowerGraphqlType))) {
				return graphqlType
			}
		}

		if (key.includes("date") || key.includes("timestamp") || aliases.some((a) => a.toLowerCase().includes("date"))) {
			return "DateTime"
		}
	}

	return "String"
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

		typeDefs.type[modelName] = {
			id: { value: "ID" } as TypeField,
			...Object.fromEntries(
				Object.entries((model as any).fields).map(([key, field]) => [
					key,
					{ value: resolve_type(field) } as TypeField,
				]),
			),
		}

		typeDefs.Subscription[`${modelName}Created`] = modelName
		typeDefs.Subscription[`${modelName}Updated`] = modelName
		typeDefs.Subscription[`${modelName}Deleted`] = "ID"
	}

	const subscriptionFields = Object.entries(typeDefs.Subscription)
		.map(([key, value]) => `  ${key}: ${value}`)
		.join("\n")

	const modelTypes = models.map((model) => {
		const modelName = model.getName()
		const fields = Object.entries(typeDefs.type[modelName] || {})
			.map(([key, value]) => `  ${key}: ${value.value}`)
			.join("\n")
		if (!fields) return ""
		return `type ${modelName} {\n${fields}\n}`
	}).filter(Boolean).join("\n\n")

	const typeDefsString = `
scalar DateTime

input DateFilter {
  equals: DateTime
  notEquals: DateTime
  gt: DateTime
  gte: DateTime
  lt: DateTime
  lte: DateTime
  isNull: Boolean
}

${filter_types}

${modelTypes}

${
		subscriptionFields
			? `type Subscription {
${subscriptionFields}
}`
			: ""
	}
`

	return { typeDefs: typeDefsString }
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
			resolve: (payload) => payload,
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
			resolve: (payload) => payload,
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
		const schema = model.schema() as Record<string, any>

		typeDefs.type[modelName] = {
			id: { value: "ID" } as TypeField,
			...Object.fromEntries(
				Object.entries(schema).map(([key, field]) => [
					key,
					{ value: resolve_type(field) } as TypeField,
				]),
			),
		}

		typeDefs.Subscription[`${modelName}Created`] = modelName
		typeDefs.Subscription[`${modelName}Updated`] = modelName
		typeDefs.Subscription[`${modelName}Deleted`] = "ID"

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
			resolve: (payload) => payload,
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
			resolve: (payload) => payload,
		}

		typeDefs.input[modelName] = Object.fromEntries(
			Object.entries(schema)
				.filter(([key]) => key !== "id")
				.map(([key, field]) => [
					key,
					{ value: resolve_type(field) } as TypeField,
				]),
		)

		typeDefs.Query[modelName] = { value: `${modelName}_query` }

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

input DateFilter {
  equals: DateTime
  notEquals: DateTime
  gt: DateTime
  gte: DateTime
  lt: DateTime
  lte: DateTime
  isNull: Boolean
}

${filter_types}

${
		models.map((model) => {
			const modelName = model.getName()
			const fields = Object.entries(typeDefs.type[modelName] || {})
				.map(([key, value]) => `  ${key}: ${value.value}`)
				.join("\n")
			return `type ${modelName} {\n${fields}\n}`
		}).join("\n\n")
	}

type Query {
${
		Object.entries(typeDefs.Query)
			.map(([key, value]) => `  ${key}(query: ${value.value}): [${key}]`)
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
				Object.entries(typeDefs.input[modelName] || {})
					.map(([key, value]) => `  ${key}: ${value.value}`)
					.join("\n")
			}
}`
		}).join("\n\n")
	}

type Subscription {
${
		Object.entries(typeDefs.Subscription)
			.map(([key, value]) => `  ${key}: ${value}`)
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
