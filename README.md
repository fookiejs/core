# Fookie server

Schema-first runtime: loads **FQL** (`.fql`), applies migrations, exposes **GraphQL**, runs **cron**, **outbox** workers for externals, and optional **saga-style compensation**.

More complete syntax examples live under [`docs/syntax.fql`](../docs/syntax.fql) and [`docs/external.fql`](../docs/external.fql).

## Empty blocks: what `{}` means

In FQL, many constructs end with a braced block. An **empty block** is valid syntax: it means “this capability exists, with **no extra** declarations inside that section.”

| Construct | Empty form | Purpose |
|-----------|------------|---------|
| Operation on a model | `read {}`, `create {}`, `update {}`, `delete {}` | Declares that the operation **is enabled** for the model with **default** behavior. You still get the GraphQL fields and runtime behavior implied by the model; you are not adding hooks, filters, order, or cursor inside that block. |
| `before { }` / `after { }` | Empty body | **No** lifecycle logic in that phase. For `after`, it also means nothing is queued for side effects from that block. |
| `compensate` | *(omit entirely)* | Not written unless you need saga-style undo steps paired with `after` externals. There is no idiomatic empty `compensate { }`; leave the keyword out when you do not need compensation. |
| `cron { SomeJob("expr") {} }` | Empty job body | The cron entry is **scheduled** but runs no statements (rare; sometimes a placeholder or minimal tick). |
| Module `before` / `after` | Empty | The module slot exists for composition (`use`); no shared hook code in that phase. Optional module `compensate` follows the same rule as on operations: declare only when needed. |

### Why write empty operations at all?

- **Explicit surface area:** `delete {}` makes it clear deletes are allowed; omitting `delete` entirely can mean “no delete operation” depending on schema defaults and tooling.
- **Symmetry and diffs:** Easier to add `before { ... }` later without restructuring the model.
- **Documentation for readers:** A row of `read {}` / `create {}` / `update {}` / `delete {}` reads as “full CRUD, no custom operation body.”

### What empty does *not* mean

- Empty **`create {}`** does **not** turn off **field-level** validators (`required`, `min`, `pattern`, etc.). Those still apply.
- Empty **`read {}`** does **not** bypass auth or model visibility rules enforced elsewhere in the stack.
- **`external { ... }`** still needs **`input`** and **`output`** shapes; optional keys like **`url`** and retry policy are separate (see [`docs/external.fql`](../docs/external.fql)).

## Run locally

From this directory, use your schema path and database URL (see `cmd/server` and `pkg/host` for flags and env). The [`demo`](../demo) compose stack is a full example with Postgres and Redis.

## License

See [`LICENSE`](LICENSE) in this directory.
