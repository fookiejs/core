# Fookie Core

Fookie is a powerful TypeScript framework for modern web applications. It helps you easily manage database operations,
authentication, authorization, and more.

## Features

- 🚀 Full TypeScript support
- 🔒 Role-based authorization
- 🔄 Automatic lifecycle management
- 📦 Database integration
- 🎯 Decorator-based API
- 🔍 Advanced filtering and querying
- ⚡ Performance optimization
- 🛡️ Security-focused design

## Installation

```bash
deno add @fookie/core
```

## Overview

Fookie includes the following core components:

- Model: Define data structures
- Field: Field types and validations
- Role: Authorization and access control
- Modify: Data transformations
- Lifecycle: Lifecycle management

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
	type: defaults.type.text,
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

Role decorator is used for authorization and access control.

```typescript
@Role({
	name: "admin",
	execute: async (payload) => {
		return payload.options.token === "admin-token"
	}
})

@Role({
	name: "owner",
	execute: async (payload) => {
		return payload.options.userId === payload.body.authorId
	}
})

@Role({
	name: "loggedIn",
	execute: async (payload) => {
		return !!payload.options.token
	}
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

## Data Types

- string: Text fields
- number: Numeric fields
- boolean: Logical fields
- date: Date fields
- json: JSON data
- array: Array fields
- object: Object fields
- enum: Enum fields
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
		status: "active",
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
	{ filter: { id: "123" } },
	{
		name: "John Doe",
		email: "john.doe@example.com",
	},
)
```

### Delete

```typescript
await User.delete({
	filter: { id: "123" },
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
import { Model, Field, Role, Modify } from "@fookie/core"

class Post extends Model {
	@Field()
	title!: string

	@Field()
	content!: string

	@Field()
	authorId!: string

	@Field()
	status!: "draft" | "published"

	@Field()
	createdAt!: Date

	@Role({
		name: "author",
		execute: async (payload) => {
			return payload.options.token === payload.body.authorId
		}
	})

	@Modify({
		name: "addTimestamp",
		execute: async (payload) => {
			payload.body.createdAt = new Date()
			return payload
		}
	})
}

// Create post
const post = await Post.create({
	title: "Hello World",
	content: "This is a test post",
	authorId: "user123",
	status: "draft"
})

// Read posts
const posts = await Post.read({
	filter: {
		status: "published",
		authorId: "user123"
	},
	orderBy: {
		createdAt: "desc"
	}
})
```

### E-Commerce Application

```typescript
import { Model, Field, Role, Modify } from "@fookie/core"

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

	@Role({
		name: "admin",
		execute: async (payload) => {
			return payload.options.role === "admin"
		}
	})

	@Modify({
		name: "validateStock",
		execute: async (payload) => {
			if (payload.body.stock < 0) {
				throw new Error("Stock cannot be negative")
			}
			return payload
		}
	})
}

// Create product
const product = await Product.create({
	name: "iPhone 13",
	description: "Apple iPhone 13 128GB",
	price: 999.99,
	stock: 100,
	categoryId: "electronics"
})

// Read products
const products = await Product.read({
	filter: {
		categoryId: "electronics",
		stock: { gt: 0 }
	},
	orderBy: {
		price: "asc"
	}
})
```

## License

MIT
