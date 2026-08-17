# fookie-eslint

> `fookie-eslint-plugin` — Opinionated ESLint rules for TypeScript enforcing explicit types, immutable data flow, and zero JS gotchas.

## Installation

```bash
npm install --save-dev fookie-eslint-plugin
```

## Setup

```js
import fookie from 'fookie-eslint-plugin'

export default [
  fookie.configs['recommended'],
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  },
]
```

Set `"useUnknownInCatchVariables": false` in `tsconfig.json`. Catch bindings must stay unannotated — TypeScript only allows `any` / `unknown` annotations there, and both are forbidden by this plugin. Pair with `no-throw-literal` so the runtime value is always an `Error`.

---

## Rules

### Type Safety

#### `no-any`
Disallow the `any` type.
```ts
// ❌
const user: any = fetchUser(profileUrl)

// ✅
const user: User = await fetchUser(profileUrl)
```

#### `no-type-assertion`
Disallow `as` type assertions. Narrow with domain type predicates — do not mix unrelated types in one union.
```ts
// ❌
const user = httpPayload as User

// ✅
function isRegisteredUser(account: Account): account is RegisteredUser {
  return account instanceof RegisteredUser
}
```

#### `no-non-null-assertion`
Disallow non-null assertions (`!`).
```ts
// ❌
queryAppRoot('app')!.innerHTML = ''

// ✅
const appRoot = queryAppRoot('app')
appRoot.replaceChildren()
```

#### `same-type-comparison`
Both sides of `===` must have the same TypeScript type.
```ts
// ❌
if (count === '5') { }

// ✅
if (count === 5) { }
```

---

### Error Handling

#### `no-throw-literal`
Only `Error` instances can be thrown.
```ts
// ❌
throw 'something went wrong'
throw { message: 'oops' }

// ✅
throw new Error('something went wrong')
```

#### `no-catch-unknown`
Disallow explicit `unknown` annotation on catch bindings. Leave the binding unannotated. Pair with `no-throw-literal` and `useUnknownInCatchVariables: false`.
```ts
// ❌
catch (caughtError: unknown) { }

// ✅
catch (caughtError) {
  reportFailure(caughtError)
}
```

#### `no-catch-instanceof`
Disallow `instanceof Error` checks inside catch blocks. Pair with `no-throw-literal` — pass the caught value to an `Error`-typed handler.
```ts
// ❌
catch (caughtError) {
  if (caughtError instanceof Error) {
    console.log(caughtError.message)
  }
}

// ✅
catch (caughtError) {
  reportFailure(caughtError)
}
```

#### `no-floating-promise`
Promises must be awaited, returned, or `.catch()`-handled.
```ts
// ❌
saveUser(user)

// ✅
await saveUser(user)
```

---

### Immutability

#### `no-array-mutating-methods`
Disallow in-place array mutation methods. Use non-mutating copies such as `toSorted` / `toReversed`, or pure derivations.
```ts
// ❌
orderLines.sort()
orderLines.reverse()
orderLines.splice(0, 1)

// ✅
orderLines.toSorted()
orderLines.toReversed()
orderLines.filter((_orderLine, orderIndex) => orderIndex !== 0)
```

#### `no-param-reassign`
Disallow reassignment of function parameters.
```ts
// ❌
function totalWithTax(amount: number): number {
  amount = amount * 1.2
  return amount
}

// ✅
function totalWithTax(amount: number): number {
  return amount * 1.2
}
```

#### `no-delete`
Disallow the `delete` operator.
```ts
// ❌
delete record.key

// ✅
const recordWithoutKey = record.withoutKey()
```

#### `no-mutable-exports`
Disallow exporting `let` variables.
```ts
// ❌
export let count = 0

// ✅
export const count = 0
```

#### `no-class-mutation`
Disallow `this.prop =` assignments outside the constructor.
```ts
// ❌
class ScoreBoard {
  update(): void { this.score = 42 }
}

// ✅
class ScoreBoard {
  private constructor(readonly score: number) {}
  static create(score: number): ScoreBoard {
    return new ScoreBoard(score)
  }
  withScore(nextScore: number): ScoreBoard {
    return new ScoreBoard(nextScore)
  }
}
```

#### `prefer-readonly-params`
Array parameters must be typed as `readonly`.
```ts
// ❌
function sumAmounts(amounts: number[]): number

// ✅
function sumAmounts(amounts: readonly number[]): number
```

---

### Local reasoning

A call's behavior must be obvious without simulating enclosing scopes or module-level ambient state. Nested functions take parameters. Methods read `this`. Module scope is `const` factories, not live collections.

#### `no-enclosing-capture`
Nested functions must not read bindings from an enclosing function. Pass the value in, or read it from `this` on a method.
```ts
// ❌
function Redis(url: string): Database {
  return {
    open(context: OpenContext): StoreBinding {
      return openOwned(url, context)
    },
  }
}

// ✅
function Redis(url: string): Database {
  return {
    key: url,
    open(context: OpenContext): StoreBinding {
      return openOwned(this.key, context)
    },
  }
}
```

`this` is only legal on a method (class method, constructor, or object-literal method). Nested arrows and `const self = this` are the same leak.

#### `no-module-mutable`
Module bindings must be `const`. `let` / `var` at program scope is ambient mutable state.
```ts
// ❌
let liveApps = []

// ✅
class LiveApps {
  private constructor(readonly apps: readonly App[]) {}
  static create(): LiveApps {
    return new LiveApps([])
  }
}
```

#### `no-module-new`
Do not `new` at module scope. `const liveApps = new Set()` is a hidden process singleton. Construct inside a function or factory.
```ts
// ❌
const liveApps = new Set()

// ✅
function openRegistry(): StoreRegistry {
  return new StoreRegistry()
}
```

---

### Control Flow

#### `require-boolean-condition`
Conditions in `if`/`while`/ternary must be explicitly boolean.
```ts
// ❌
if (user) { }
if (orderLines.length) { }

// ✅
if (user.isActive === true) { }
if (orderLines.length > 0) { }
```

#### `exhaustive-switch`
Switch over union types must cover all members without a `default` fallback.
```ts
// ❌
type AccountStatus = 'active' | 'inactive' | 'banned'
switch (accountStatus) {
  case 'active': return 'Active'
  case 'inactive': return 'Inactive'
}

// ✅
switch (accountStatus) {
  case 'active': return 'Active'
  case 'inactive': return 'Inactive'
  case 'banned': return 'Banned'
}
```

#### `consistent-return`
Functions must either always or never return a value.
```ts
// ❌
function getStatusLabel(accountStatus: string) {
  if (accountStatus === 'active') {
    return 'Active'
  }
}

// ✅
function getStatusLabel(accountStatus: string): string {
  if (accountStatus === 'active') {
    return 'Active'
  }
  return 'Unknown'
}
```

#### `no-async-without-await`
Async functions must contain at least one `await`.
```ts
// ❌
async function loadUser(): Promise<User> {
  return db.findUser()
}

// ✅
async function loadUser(): Promise<User> {
  return await db.findUser()
}
```

#### `no-loop-func`
Disallow function definitions inside loops.
```ts
// ❌
for (let count = 0; count < 3; count++) {
  setTimeout(() => console.log(count), 0)
}

// ✅
for (const orderLine of orderLines) {
  processOrderLine(orderLine)
}
```

---

### Naming

#### `no-generic-names`
Disallow vague names like `data`, `info`, `temp`, `result`, `obj`, `item`, `value`, `element`.
```ts
// ❌
const data = await fetchUser()
const temp = data.name

// ✅
const user = await fetchUser()
const displayName = user.name
```

#### `no-placeholder-names`
Disallow placeholder names like `foo`, `bar`, `baz`, `qux`, `dummy`.
```ts
// ❌
catalogEntries.map(foo => foo.name)

// ✅
catalogEntries.map(catalogEntry => catalogEntry.name)
```

#### `no-shadow`
Disallow variable declarations that shadow outer scope variables.
```ts
// ❌
const user = getUser()
users.map(user => user.name)

// ✅
const currentUser = getUser()
users.map(member => member.name)
```

---

### JS Gotchas

#### `no-for-in`
Disallow `for...in` — it iterates the prototype chain.
```ts
// ❌
for (const configKey in config) { }

// ✅
for (const configKey of Object.keys(config)) { }
```

#### `no-union-type`
Disallow TypeScript union types (`A | B`) everywhere.
```ts
// ❌
function normalize(value: string | false): string { return "" }
type IdOrMissing = string | false

// ✅
function normalize(value: string): string { return value }
type EntityId = string
```

#### `no-implicit-coercion`
Disallow implicit type coercions.
```ts
// ❌
const parsedAmount = +'42'
const isEnabled = !!rawFlag

// ✅
const parsedAmount = Number('42')
const isEnabled = Boolean(rawFlag)
```

#### `no-typeof`
Disallow `typeof` — validate with Zod (`safeParse`), narrow from Models.
```ts
// ❌
if (typeof accountStatus === 'string') { }

// ✅
if (accountStatusSchema.safeParse(accountStatus).success === true) { }
```

#### `no-hasownproperty`
Disallow `hasOwnProperty` / `Object.hasOwn` — walk entries, Zod-validate, or use Model fields.
```ts
// ❌
Object.prototype.hasOwnProperty.call(record, key)

// ✅
for (const [fieldKey, fieldValue] of Object.entries(record)) { usePair(fieldKey, fieldValue) }
```
#### `no-eval`
Disallow `eval()` and indirect eval patterns.
```ts
// ❌
eval('console.log(1)')

// ✅
parseConfig(configSource)
```

#### `no-new-wrappers`
Disallow `new String()`, `new Number()`, `new Boolean()`.
```ts
// ❌
const greeting = new String('hello')

// ✅
const greeting = 'hello'
```

#### `prefer-includes`
Require `.includes()` over `.indexOf()` comparisons.
```ts
// ❌
orderLines.indexOf('target') !== -1

// ✅
orderLines.includes('target')
```

#### `no-string-concat`
Disallow `+` string concatenation. Use template literals.
```ts
// ❌
'Hello, ' + displayName + '!'

// ✅
`Hello, ${displayName}!`
```

#### `no-legacy-globals`
Disallow host globals (`window`, `document`, `global`, `globalThis`), legacy calls (`parseInt`, `isNaN`, …), and `arguments`.
```ts
// ❌
window.addEventListener('click', clickHandler)
parseInt(raw, 10)

// ✅
addEventListener('click', clickHandler)
Number.parseInt(raw, 10)
```

---

### Modules

#### `no-require`
Disallow `require()`. Use ES `import`.
```ts
// ❌
const fs = require('fs')

// ✅
import fs from 'fs'
```

#### `no-default-export`
Disallow default exports. Use named exports.
```ts
// ❌
export default function handleRequest() { }

// ✅
export function handleRequest(): void { }
```

#### `no-process-env`
Disallow direct `process.env` access. Use a typed config module.
```ts
// ❌
const port = process.env.PORT

// ✅
import { config } from './config.js'
const port = config.port
```

---

### Classes

#### `require-private-constructor`
Class constructors must be `private` or `protected`. Use static factory methods. Use `protected` on abstract bases that subclasses extend via `super()`.
```ts
// ❌
class User {
  constructor(public name: string) {}
}

// ✅
class User {
  private constructor(public name: string) {}
  static create(name: string): User {
    return new User(name)
  }
}

// ✅ base error type (subclasses call super)
class FookieError extends Error {
  protected constructor(message: string) {
    super(message)
  }
  static create(message: string): FookieError {
    return new FookieError(message)
  }
}
```

#### `no-class-mutation`
Disallow `this.prop =` outside the constructor.
```ts
// ❌
class Counter {
  increment(): void { this.count++ }
}

// ✅
class Counter {
  private constructor(readonly count: number) {}
  static create(count: number): Counter {
    return new Counter(count)
  }
  increment(): Counter {
    return new Counter(this.count + 1)
  }
}
```

---

### Functions

#### `require-explicit-return-type`
Exported functions and public class methods must declare return types.
```ts
// ❌
export function loadUserById(userId: string) {
  return db.findUserById(userId)
}

// ✅
export function loadUserById(userId: string): Promise<User> {
  return db.findUserById(userId)
}
```

#### `no-comments`
Disallow code comments — write self-documenting code instead.
```ts
// ❌
// resolve account from store
const account = await fetchUserById(userId)

// ✅
const account = await fetchUserById(userId)
```

#### `no-null-undefined`
Disallow `null`, `undefined`, and `void` as values. Do not call APIs that return `null`. Prefer a present value or throw.
```ts
// ❌
function findUserById(userId: string): User | null {
  return null
}

// ✅
function loadUserById(userId: string): User {
  return userRepository.loadByIdOrThrow(userId)
}
```

#### `min-function-lines`
Not in `recommended`. A function is as long as the work. Padding a body with extra `safeParse` checks or constructor post-conditions to hit a line quota is defensive programming. The rule stays in the plugin for opt-in only.
```ts
function loadAccount(): Account {
  return accountRepository.loadOrThrow(accountId)
}
```

#### `no-unknown`
Disallow the `unknown` type. Use a specific Model or domain union.
```ts
// ❌
function parseAccount(raw: unknown): Account {
  return Account.create(raw)
}

// ✅
function parseAccount(raw: AccountDraft): Account {
  return Account.create(raw)
}
```

#### `no-nullish-operators`
Disallow `??` and `?.`. Design Models that guarantee presence.
```ts
// ❌
const displayName = account.name ?? 'guest'
const city = account.address?.city

// ✅
const displayName = account.name
const city = account.address.city
```

#### `no-empty-string`
Disallow empty string literals (`""`).
```ts
// ❌
const label = ''

// ✅
const label = DEFAULT_LABEL
```

#### `require-curly`
Require curly braces for all control flow statements.
```ts
// ❌
if (account.isActive === true) return account

// ✅
if (account.isActive === true) {
  return account
}
```

---

### NaN

#### `no-nan`
Disallow the `NaN` keyword. Check with `Number.isNaN` when forced to confront foreign numeric junk — prefer Models that never carry NaN.
```ts
// ❌
const broken = NaN

// ✅
if (Number.isNaN(foreignAmount) === true) {
  throw new Error('amount invalid')
}
```

#### `no-nan-in-math-result`
Do not feed `Math` calls that can yield NaN straight into arithmetic without a guard.
```ts
// ❌
const root = Math.sqrt(area) + 1

// ✅
const rootCandidate = Math.sqrt(area)
if (Number.isNaN(rootCandidate) === true) {
  throw new Error('area invalid')
}
const root = rootCandidate + 1
```

#### `no-parseint-nan`
Do not use `parseInt` / `parseFloat` results in arithmetic without a NaN guard.
```ts
// ❌
const total = parseInt(rawCount, 10) + 1

// ✅
const parsedCount = parseInt(rawCount, 10)
if (Number.isNaN(parsedCount) === true) {
  throw new Error('count invalid')
}
const total = parsedCount + 1
```

#### `no-nan-array-indexof`
Disallow `array.indexOf(NaN)`. Do not put NaN in arrays — redesign the Model.
```ts
// ❌
amounts.indexOf(NaN)

// ✅
amounts.includes(targetAmount)
```

---

### Mutation

#### `no-object-assign-mutation`
Disallow `Object.assign` onto an existing reference.
```ts
// ❌
Object.assign(account, patch)

// ✅
const nextAccount = account.withPatch(patch)
```

#### `no-prototype-mutation`
Disallow mutating prototypes at runtime.
```ts
// ❌
Account.prototype.tag = 'x'

// ✅
class Account {
  private constructor(readonly tag: string) {}
  static create(tag: string): Account {
    return new Account(tag)
  }
}
```

#### `no-define-property`
Disallow `Object.defineProperty` / `Object.defineProperties`.
```ts
// ❌
Object.defineProperty(account, 'locked', { value: true })

// ✅
const lockedAccount = account.withLocked(true)
```

#### `no-map-set-mutation`
Disallow mutating `Map` / `Set` instances created with `new`.
```ts
// ❌
const registry = new Map()
registry.set(userId, account)

// ✅
const registry = new Map([[userId, account]])
```

#### `no-spread`
Disallow spread and rest (`...`). Copying bags is not Model work — return a new instance through an explicit method.
```ts
// ❌
const nextAccount = { ...account, ...patch }
const { key, ...rest } = record
fn(...args)

// ✅
const nextAccount = account.withPatch(patch)
const recordWithoutKey = record.withoutKey()
fn(firstArg, secondArg)
```
