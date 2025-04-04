# @fookiejs/auth

Authentication package for Fookie Framework that provides secure user authentication.

## Overview

@fookiejs/auth is a powerful authentication module designed for the Fookie Framework. It provides built-in support for
Google OAuth authentication and includes features for user account management with email anonymization capabilities.

## Features

- Google OAuth Integration
- Automatic Account Creation & Management
- Email Anonymization for Deleted Accounts

## Setup

### Requirements

- Deno
- @fookiejs/core

### Installation

```bash
import { initAuth } from "@fookiejs/auth"
```

## Usage

### Initialize Authentication

```ts
import { initAuth } from "@fookiejs/auth"
import { defaults } from "@fookiejs/core"

const database = defaults.database.store // Any FookieJS DB package
const { Account, loggedIn } = initAuth(database)
```

### Authentication Flow

1. Client sends request with Google token:

```ts
// Token format: "google_YOUR_GOOGLE_TOKEN"
const response = await Model.read({}, {
	token: "google_YOUR_GOOGLE_TOKEN",
})
```

2. System automatically:
   - Verifies the Google token
   - Creates/retrieves user account
   - Manages authentication state

### Account Model Structure

```ts
interface Account {
	iss: string // Token issuer
	sub: string // Subject identifier
	email: string // User email
	name: string // User name
	picture: string // Profile picture URL
}
```

### Role-Based Access

```ts
// Example of protected route using loggedIn role
@Model.Decorator({
	database,
	binds: {
		[Method.READ]: {
			role: [loggedIn],
		},
	},
})
class ProtectedModel extends Model {
	// Your model definition
}
```
