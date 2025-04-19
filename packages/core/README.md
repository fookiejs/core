# @fookiejs/core

Core package of the Fookie Framework, providing a model-centric architecture for building scalable TypeScript
applications.

## Architecture Overview

Fookie Core is built around a model-centric architecture that emphasizes type safety, extensibility, and developer
experience. The framework follows these key principles:

1. Model-First Development
2. Lifecycle-Driven Operations
3. Pluggable Database Architecture
4. Type-Safe Query System
5. Aspect-Oriented Programming via Decorators

## Core Concepts

### Models

Models are the central building blocks, representing both data structure and business logic:

```typescript
@Model.Decorator({
	database: defaults.database.store,
	binds: {
		create: { role: [adminRole] },
		read: { role: [] },
		update: { role: [ownerRole] },
		delete: { role: [adminRole] },
	},
})
class Product extends Model {
	@Field.Decorator({
		type: CoreTypes[TypeStandartization.String],
		features: [defaults.feature.required],
	})
	name!: string

	@Field.Decorator({
		type: CoreTypes[TypeStandartization.Float],
		features: [defaults.feature.required],
	})
	price!: number

	@Field.Decorator({
		type: defaults.type.enum(ProductStatus),
		default: ProductStatus.ACTIVE,
	})
	status!: ProductStatus
}

// Enum example
enum ProductStatus {
	ACTIVE = "ACTIVE",
	DISCONTINUED = "DISCONTINUED",
	OUT_OF_STOCK = "OUT_OF_STOCK",
}
```

### Lifecycle Hooks

Operations follow a defined lifecycle sequence:

1. **Pre-Rules** (`pre-rule`): Initial validation
2. **Pre-Modify** (`pre-modify`): Data transformation before processing
3. **Role Check** (`role`): Authorization
4. **Modify** (`modify`): Main data transformation
5. **Rules** (`rule`): Business rule validation
6. **Method** (`method`): Database operation
7. **Filter** (`filter`): Result filtering
8. **Effect** (`effect`): Side effects
9. **Global Hooks**: System-wide rules and effects

### Database Abstraction

The database layer is completely abstracted and pluggable:

```typescript
const database = Database.create({
	key: "custom-db",
	primaryKeyType: TypeStandartization.String,
	modify: function (model) {
		return {
			[Method.CREATE]: async (payload) => {/* ... */},
			[Method.READ]: async (payload) => {/* ... */},
			[Method.UPDATE]: async (payload) => {/* ... */},
			[Method.DELETE]: async (payload) => {/* ... */},
		}
	},
})
```

### Query System

Type-safe query system with rich filtering capabilities:

```typescript
const products = await Product.read({
	filter: {
		price: {
			gte: 100,
			lte: 1000,
		},
		name: {
			like: "Premium%",
		},
	},
	orderBy: {
		price: "desc",
	},
	limit: 10,
	offset: 0,
})
```

### Data Management

#### Soft Delete

Built-in soft delete mechanism:

- Records are marked with `deletedAt` timestamp instead of being removed
- Automatically filtered from read operations
- Can be bypassed with `hardDelete: true` option

```typescript
// Soft delete (default)
await Product.delete({
	filter: { id: { equals: "123" } },
})

// Hard delete
await Product.delete({
	filter: { id: { equals: "123" } },
}, {
	hardDelete: true,
})
```

## Advanced Features

### Custom Field Types

```typescript
const customType = Type.create({
	key: "custom",
	validate: (value: unknown) => {
		// Custom validation logic
		return true
	},
	queryController: {
		equals: (value) => value === value,
		// Custom query operators
	},
})
```

### Role-Based Access Control

```typescript
const adminRole = Role.create({
	key: "admin",
	execute: async (payload) => {
		return payload.options.userRole === "ADMIN"
	},
})

const ownerRole = Role.create({
	key: "owner",
	execute: async (payload) => {
		return payload.options.userId === payload.body.ownerId
	},
})
```

### Lifecycle Hooks

```typescript
@Model.Decorator({
	database: defaults.database.store,
	binds: {
		create: {
			pre-modify: [
				Modify.create({
					key: "set-timestamp",
					execute: async (payload) => {
						payload.body.createdAt = new Date().toISOString()
						return payload
					}
				})
			],
			effect: [
				Effect.create({
					key: "notify-creation",
					execute: async (payload) => {
						// Post-creation logic
					}
				})
			]
		}
	}
})
```

## Performance Considerations

1. **Query Optimization**
   - Use specific filters to reduce data load
   - Leverage `attributes` to select only needed fields
   - Consider pagination for large datasets

2. **Lifecycle Management**
   - Keep lifecycle hooks lightweight
   - Use effects for heavy operations
   - Consider caching for frequent operations

3. **Database Operations**
   - Implement proper indexes
   - Use batch operations when possible
   - Consider implementing custom database adapters for specific needs

## Best Practices

1. **Model Design**
   - Keep models focused and single-responsibility
   - Use inheritance for shared functionality
   - Implement proper validation at field level

2. **Security**
   - Always implement proper role checks
   - Use pre-rules for input validation
   - Never trust client input

3. **Error Handling**
   - Implement proper error handling in lifecycle hooks
   - Use FookieError for structured error responses
   - Log errors appropriately

## TypeScript Integration

The framework is built with TypeScript first in mind:

- Full type inference for queries
- Type-safe model definitions
- Decorator-based metadata
- Strict null checks
- Generic type constraints

## Testing

```typescript
// Example test setup
Deno.test("Product CRUD", async () => {
	const product = await Product.create({
		name: "Test Product",
		price: 99.99,
	})

	const retrieved = await Product.read({
		filter: { id: { equals: product.id } },
	})

	assertEquals(retrieved[0].name, "Test Product")
})
```

## Features

- Model-based Architecture
- Built-in Soft Delete Support
- Flexible Database Adapters
- Advanced Query System
- Lifecycle Hooks
- Role-based Access Control
- Field Validation
- TypeScript Support

## Setup

### Requirements

- Deno

### Installation

```bash
import { Model, Field, defaults } from "@fookiejs/core"
```

## Usage

### Define a Model

```ts
@Model.Decorator({
	database: defaults.database.store,
	binds: {
		create: { role: [] },
		read: { role: [] },
		update: { role: [] },
		delete: { role: [] },
	},
})
class User extends Model {
	@Field.Decorator({
		type: CoreTypes[TypeStandartization.String],
		features: [defaults.feature.required],
	})
	name!: string

	@Field.Decorator({
		type: CoreTypes[TypeStandartization.String],
		features: [defaults.feature.required],
	})
	email!: string
}
```

### CRUD Operations

```ts
// Create
const user = await User.create({
    name: "John Doe",
    email: "john@example.com"
})

// Read
const users = await User.read({
    filter: {
        name: { equals: "John Doe" }
    }
})

// Update
await User.update({
    filter: {
        id: { equals: "user_id" }
    }
}, {
    name: "Jane Doe"
})

// Delete (Soft Delete by default)
await User.delete({
    filter: {
        id: { equals: "user_id" }
})

// Hard Delete
await User.delete({
    filter: {
        id: { equals: "user_id" }
    }
}, {
    hardDelete: true
})
```

### Query System

```ts
// Complex queries
const users = await User.read({
	filter: {
		name: { like: "John%" },
		email: { notEquals: "admin@example.com" },
	},
	orderBy: {
		name: "asc",
	},
	limit: 10,
	offset: 0,
})
```

### Lifecycle Hooks

```ts
@Model.Decorator({
    database: defaults.database.store,
    binds: {
        create: {
            role: [],
            effect: [
                Effect.create({
                    key: "log-creation",
                    execute: async (payload) => {
                        console.log("Created:", payload.body)
                    }
                })
            ]
        }
    }
})
```

### Built-in Features

1. Automatic Fields:
   - `id`: Primary key
   - `createdAt`: Creation timestamp
   - `updatedAt`: Last update timestamp
   - `deletedAt`: Soft delete timestamp

2. Soft Delete:
   - Automatic soft delete support
   - Records are marked as deleted instead of being removed
   - Deleted records are automatically filtered from queries
   - Optional hard delete with `hardDelete: true` option

3. Query Features:
   - Complex filtering
   - Sorting
   - Pagination
   - Field selection
   - Type-safe queries
