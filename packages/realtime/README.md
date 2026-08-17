# @fookiejs/realtime

Register rules. A client opens `/stream?client=` and waits. `who` returns which connected ids get the event.

```ts
import { Method, realtime } from "@fookiejs/realtime";

const live = realtime(
  [
    {
      model: User,
      method: Method.CREATE,
      who(clientIds, fookie) {
        fookie.list(User, {});
        return clientIds;
      },
    },
  ],
  {
    listen: ["4100"],
    bus: [],
    batch: [],
  },
);
live.watch(app);
```

`watch` stores that fookie for `who`. `handle` is `/stream`. `stop` closes the listen socket and every subscriber. No rule for a method means that method does not emit. Frames are `{ model, operation, id, runId, signal }` with no entity body.

Pass `bus: [NotifyBus({ pool })]` from `@fookiejs/postgresql` when fookie and realtime are separate processes. Fookie already notifies postgres when an operation finishes; realtime only listens. `bus: []` stays in-process.
