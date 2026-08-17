# no-union-type

Disallow TypeScript union types (`A | B`).

## Rule Details

Union types are forbidden everywhere: parameters, return types, interfaces, type aliases, and variable annotations. A value has one type. Use a single named type, separate functions, or a dedicated result object shape without `|`.

Examples of **incorrect** code:

```ts
function normalize(value: string | false): string {
  return ""
}

type IdOrMissing = string | false

interface Entity {
  title: string | number
}

type LoadResult = { ok: true; value: string } | { ok: false }
```

Examples of **correct** code:

```ts
function normalize(value: string): string {
  return value
}

type EntityId = string

interface Entity {
  title: string
}

type LoadOk = { ok: true; value: string }
type LoadErr = { ok: false }
```
