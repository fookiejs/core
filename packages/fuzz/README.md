# @fookiejs/fuzz

Generates the possibility space for a fookie app instead of imagining it. Every field is already a zod
schema, so valid bodies, boundary bodies and deliberately broken ones can be **derived from the model**
rather than written by hand.

```ts
import { fuzz, seedFrom, summarise } from "@fookiejs/fuzz";

const report = await fuzz(app, seedFrom("nightly"), 200, runStep);
console.log(summarise(report));
```

## Everything replays

A run is a seed and a length, nothing else. The same seed produces the same plan, the same bodies and
the same order — `report.replay` prints the call that reproduces it. A fuzzer you cannot replay is a
rumour generator, so the generator refuses any seed it could not reproduce from.

`shrink(plan, n)` cuts a failing plan down to its first `n` steps so a failure can be narrowed by
bisection rather than by staring.

## What it generates

Bodies come from the column types the model already declares: booleans, whole numbers for `INTEGER`,
uuids, and text drawn from a pool that includes the things people forget — spaces, unicode, quotes, a
script tag, a SQL fragment. A unique column gets a value that will not collide with its own earlier
draws. A relation is only filled once a real parent exists, never with an invented id.

Broken bodies name their own breakage, so a report says _why_ a call should have been refused: a missing
field, a wrong type, an empty string, an unknown field, a negative number where none belongs, and a
hundred thousand character string.

Plans are sequences, not single calls, because that is where the bugs live: create, list, update and
delete against entities the plan itself made. A plan always opens with something that can exist.

## Invariants

After a plan runs, the world is checked rather than the responses:

- a completed run is never also compensated
- a dead letter states its reason
- an unsettled external still belongs to a run — a pending row whose run is gone is a payment nobody
  will ever resume
- no external climbs past a sane attempt budget

Findings are scoped to the models under test. A shared database full of other people's rows must never
be reported as your bug.

## License

MIT
