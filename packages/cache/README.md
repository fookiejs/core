# @fookiejs/cache

Caching package for Fookie Framework that provides efficient data caching capabilities.

## Overview

@fookiejs/cache is a powerful caching module designed for the Fookie Framework. It provides automatic caching for your
models with configurable TTL (Time To Live) and automatic cache invalidation.

## Features

- Automatic Response Caching
- Configurable TTL (Time To Live)
- Automatic Cache Invalidation
- Hash-based Cache Keys
- Model-specific Caching
- System-level Access Control
- Expired Cache Cleanup

## Setup

### Requirements

- Deno
- @fookiejs/core
- moment

### Installation

```bash
import { initCache } from "@fookiejs/cache"
```

## Usage

### Initialize Cache

```ts
import { defaults } from "@fookiejs/core"
import { initCache } from "@fookiejs/cache"

const database = defaults.database.store // Any FookieJS DB package
const { FookieCache, createMixin } = initCache(database)
```

### Add Caching to Models

```ts
@Model.Decorator({
	database,
	mixins: [createMixin(3600)], // Cache for 1 hour
	binds: {
		[Method.READ]: {
			modify: [isCached],
			effect: [cacheResponse],
		},
		[Method.CREATE]: {
			effect: [clearModelCache],
		},
		[Method.UPDATE]: {
			effect: [clearModelCache],
		},
		[Method.DELETE]: {
			effect: [clearModelCache],
		},
	},
})
class CachedModel extends Model {
	// Your model definition
}
```

### Cache Structure

```ts
interface FookieCache {
	model: string // Model name
	hash: string // Unique hash of request
	data: string // Cached response data
	expiresAt: string // Cache expiration timestamp
}
```

### Cache Features

1. Automatic Caching:
   - Responses are automatically cached based on request parameters
   - Cache keys are generated using SHA-256 hashing
   - Cached data includes token, query, and model information

2. Cache Invalidation:
   - Automatic invalidation on CREATE/UPDATE/DELETE operations
   - Expired cache cleanup
   - Model-specific cache clearing
