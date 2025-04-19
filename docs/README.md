# Fookie Core

Fookie is a revolutionary model-based TypeScript framework that redefines how we build applications. By focusing on
models as the core building blocks, it provides a powerful and intuitive way to handle data operations, business logic,
and application flow. Unlike traditional frameworks, Fookie's model-centric approach brings unprecedented flexibility
and type safety to your development process. Perfect for rapid prototyping, POCs, and startup projects, while still
being powerful enough for large-scale applications.

## Features

- 🚀 Full TypeScript support
- 🔒 Role-based authorization
- 🔄 Automatic lifecycle management
- 📦 Database integration
- 🎯 Decorator-based API
- 🔍 Advanced filtering and querying
- ⚡ Performance optimization
- 🛡️ Security-focused design
- 📊 Built-in OpenTelemetry support for metrics, traces and logs

## Installation

```bash
deno add @fookie/core
```

## Overview

Fookie includes the following core components:

- Model: Define data structures
- Field: Field types and validations
- Lifecycle: Lifecycle management
  - pre-rule: Initial rule check
  - pre-modify: Initial data transformation
  - role: Authorization check
  - modify: Data transformation
  - rule: Rule check
  - method: Main DB operation
  - filter: Result filtering
  - effect: Side effects
  - global-pre-rule: Global initial rule check
  - global-pre-modify: Global initial data transformation
  - global-effect: Global side effects
- OpenTelemetry: Built-in observability

## Core Components

### Model

Model is used to define your data structures. Each model corresponds to a table in the database.

```typescript
import { defaults, Field, Model } from "@fookie/core"

@Model.Decorator({ name: "users", database: defaults.database.store })
class User extends Model {
	@Field()
	name!: string

	@Field()
	email!: string

	@Field()
	password!: string

	@Field()
	createdAt!: Date
}
```

### Field

Field decorator defines the properties of model fields.

```typescript
@Field({
	type:CoreTypes[TypeStandartization.String],
	features: [
		defaults.feature.required,
		defaults.feature.unique
	],
	validators: [
		(value) => value.length >= 3 && value.length <= 50,
		(value) => /^[a-zA-Z0-9]+$/.test(value)
	]
})
username!: string

@Field({
	type: defaults.type.number,
	features: [
		defaults.feature.required
	],
	validators: [
		(value) => value >= 0 && value <= 100
	]
})
age!: number

@Field({
	type: defaults.type.date,
	features: [
		defaults.feature.required,
		defaults.feature.default(() => new Date())
	]
})
createdAt!: Date
```

### Role

Role is used for authorization and access control.

```typescript
const adminRole = Role.create({
	key: "admin",
	execute: async (payload) => {
		return payload.options.token === "admin-token"
	},
})

const ownerRole = Role.create({
	key: "owner",
	execute: async (payload) => {
		return payload.options.userId === payload.body.authorId
	},
})
```

### Modify

Modify decorator is used for data transformations.

```typescript
@Modify({
	name: "hashPassword",
	execute: async (payload) => {
		payload.body.password = await hash(payload.body.password)
		return payload
	}
})

@Modify({
	name: "addTimestamp",
	execute: async (payload) => {
		payload.body.createdAt = new Date()
		return payload
	}
})

@Modify({
	name: "sanitizeInput",
	execute: async (payload) => {
		payload.body.content = sanitize(payload.body.content)
		return payload
	}
})
```

### Lifecycle

Each model operation goes through the following stages:

1. pre-rule: Initial rule check
2. pre-modify: Initial data transformation
3. role: Authorization check
4. modify: Data transformation
5. rule: Rule check
6. method: Main operation (create/read/update/delete)
7. filter: Result filtering
8. effect: Side effects
9. global-effect: Global side effects

```typescript
const user = await User.create({
	name: "John",
	email: "john@example.com",
	password: "secret123",
})
```

### OpenTelemetry

Fookie automatically collects metrics, traces and logs using Deno's built-in OpenTelemetry support.

```typescript
// Enable OpenTelemetry in deno.json
{
	"tasks": {
		"start": "deno run --allow-all --trace-otel main.ts"
	}
}
```

When OpenTelemetry is enabled, Fookie automatically collects:

- Metrics: Operation counts, latencies, error rates (WIP)
- Traces: Request flow, database operations, lifecycle stages
- Logs: Operation details, errors, warnings (WIP)

## Data Types

- string: Text fields
- number: Numeric fields
- boolean: Logical fields
- date: Date fields
- json: JSON data
- array: Array fields
- object: Object fields
- relation: Relational data fields

## Database Operations

### Create

```typescript
const user = await User.create({
	name: "John",
	email: "john@example.com",
	password: "secret123",
})
```

### Read

```typescript
// Get all users
const users = await User.read()

// Filtering
const activeUsers = await User.read({
	filter: {
		status: { equals: "active" },
		age: { gt: 18 },
	},
})

// Sorting
const sortedUsers = await User.read({
	orderBy: {
		createdAt: "desc",
	},
})

// Pagination
const paginatedUsers = await User.read({
	limit: 10,
	offset: 0,
})
```

### Update

```typescript
await User.update(
	{ filter: { id: { equals: "123" } } },
	{
		name: "John Doe",
		email: "john.doe@example.com",
	},
)
```

### Delete

```typescript
await User.delete({
	filter: { id: { equals: "123" } },
})
```

## Error Handling

```typescript
try {
	await User.create({
		name: "John",
		email: "invalid-email",
	})
} catch (error) {
	if (error instanceof FookieError) {
		console.log(error.validationErrors)
	}
}
```

## Example Applications

### Blog Application

```typescript
import { Field, Lifecycle, Method, Model, Modify, Role } from "@fookie/core"

@Model.Decorator({
	name: "posts",
	database: defaults.database.store,
	binds: {
		[Method.CREATE]: {
			[Lifecycle.MODIFY]: [
				Modify.create({
					key: "addTimestamp",
					execute: async (payload) => {
						payload.body.createdAt = new Date()
						return payload
					},
				}),
			],
		},
	},
})
class Post extends Model {
	@Field()
	title!: string

	@Field()
	content!: string

	@Field()
	authorId!: string

	@Field()
	status!: "draft" | "published"

	@Field({ type: defaults.type.timestamp })
	createdAt!: Date

	authorRole = Role.create({
		key: "author",
		execute: async (payload) => {
			return payload.options.token === payload.body.authorId
		},
	})
}

// Create post
const post = await Post.create({
	title: "Hello World",
	content: "This is a test post",
	authorId: "user123",
	status: "draft",
})

console.log(post instanceof Post) // true

// Read posts
const posts = await Post.read({
	filter: {
		status: { equals: "published" },
		authorId: { equals: "user123" },
	},
	orderBy: {
		createdAt: "desc",
	},
})

console.log(posts[0] instanceof Post) // true
```

### E-Commerce Application

```typescript
import { Field, Lifecycle, Method, Model, Modify, Role } from "@fookie/core"

@Model.Decorator({
	name: "products",
	database: defaults.database.store,
	binds: {
		[Method.CREATE]: {
			[Lifecycle.Rule]: [
				Rule.create({
					key: "validateStock",
					execute: async (payload) => {
						if (payload.body.stock < 0) {
							return true
						}
						return false
					},
				}),
			],
		},
	},
})
class Product extends Model {
	@Field()
	name!: string

	@Field()
	description!: string

	@Field()
	price!: number

	@Field()
	stock!: number

	@Field()
	categoryId!: string

	adminRole = Role.create({
		key: "admin",
		execute: async (payload) => {
			return payload.options.role === "admin"
		},
	})
}

// Create product
const product = await Product.create({
	name: "iPhone 13",
	description: "Apple iPhone 13 128GB",
	price: 999.99,
	stock: 100,
	categoryId: "electronics",
})

console.log(product instanceof Product) // true

// Read products
const products = await Product.read({
	filter: {
		categoryId: { equals: "electronics" },
		stock: { gt: 0 },
	},
	orderBy: {
		price: "asc",
	},
})

console.log(products[0] instanceof Product) // true
```

## License

MIT

## Special Thanks

- 🦕 [Deno](https://deno.land) - The modern runtime for JavaScript and TypeScript
- 📦 [JSR](https://jsr.io) - The JavaScript Registry

## Pros & Cons

### Advantages

- 🚀 Rapid development with plug-and-play functionality
- 🔄 Automated API generation
- 📦 Ecosystem of packages
- 🎯 Type-safe development
- 🔍 Built-in validation and error handling
- ⚡ Easy to prototype and test ideas

### Disadvantages

- 🔄 Lazy loading approach may result in multiple requests
- ⚡ Performance might not be optimal for high-frequency operations
- 🔒 Role management can become complex in large applications
- 🔄 Less control over database queries compared to raw SQL
