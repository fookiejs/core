// dont edit

import {
  app,
  Model,
  External,
  Types,
  Done,
  Running,
  Failed,
  type ExternalEventOf,
  type ExternalOutputOf,
  type CreateResult,
} from "@fookiejs/core";

const fraud = External({
  name: "fraud.score",
  input: {
    amount: Types.currency,
  },
  output: {
    score: Types.int,
  },
  attempts: 3,
  backoff: "exponential",
});

const notify = External({
  name: "notify.send",
  input: {
    to: Types.email,
    body: Types.string,
  },
  output: {
    sent: Types.bool,
  },
  attempts: 3,
  backoff: "fixed",
});

const user = Model({
  name: "User",
  fields: {
    email: Types.email.unique(),
    name: Types.string.index(),
  },
  flow: {
    async create() {
      return Done;
    },
    async list() {
      return Done;
    },
    async update() {
      return Done;
    },
    async delete() {
      return Done;
    },
  },
});

const merchant = Model({
  name: "Merchant",
  fields: {
    site: Types.url,
    rating: Types.float.min(0).max(5),
  },
  flow: {
    async create() {
      return Done;
    },
    async list() {
      return Done;
    },
    async update() {
      return Done;
    },
    async delete() {
      return Done;
    },
  },
});

const order = Model({
  name: "Order",
  fields: {
    buyer: user,
    merchant: merchant,
    amount: Types.currency,
    score: Types.int,
    status: Types.enum("draft", "confirmed", "shipped"),
  },
  flow: {
    async create(flow) {
      flow.metric.increment("created");
      const result = await flow.external(fraud, {
        amount: flow.body.amount,
      });
      if (result.signal === Running) {
        return Running;
      }
      if (result.signal === Failed) {
        return Failed;
      }
      if (result.output.score > 80) {
        flow.log("riskli işlem reddedildi", {
          score: result.output.score,
        });
        return Failed;
      }
      flow.body.score = result.output.score;
      flow.body.status = "confirmed";
      const logged = await flow.create(orderLog, {
        message: "sipariş onaylandı",
      });
      if (logged.signal === Running) {
        return Running;
      }
      if (logged.signal === Failed) {
        return Failed;
      }
      const notified = await flow.external(notify, {
        to: "ops@example.com",
        body: `sipariş ${flow.id} onaylandı`,
      });
      if (notified.signal === Running) {
        return Running;
      }
      if (notified.signal === Failed) {
        return Failed;
      }
      flow.log("sipariş onaylandı", {
        score: result.output.score,
      });
      return Done;
    },
    async list(flow) {
      flow.filter.amount.gt(0);
      flow.filter.status.eq("confirmed");
      return Done;
    },
    async update(flow) {
      flow.filter.status.eq("draft");
      flow.metric.increment("updated");
      flow.log("sipariş güncellendi", {
        query: flow.filter,
      });
      return Done;
    },
    async delete(flow) {
      flow.filter.status.eq("draft");
      flow.metric.increment("deleted");
      flow.log("sipariş silindi", {
        filter: flow.filter,
      });
      return Done;
    },
  },
});

const orderLog = Model({
  name: "OrderLog",
  fields: {
    order: order,
    message: Types.string,
  },
  flow: {
    async create() {
      return Done;
    },
    async list() {
      return Done;
    },
    async update() {
      return Done;
    },
    async delete() {
      return Done;
    },
  },
});

const externals = [fraud, notify] as const;

type ExternalEvent = ExternalEventOf<(typeof externals)[number]>;

const externalEvents: ExternalEvent[] = [];

const fookie = app({
  listen: "3001",
  database: "postgres://localhost:5432/fookie",
  models: [user, merchant, orderLog, order],
  externals: [...externals],
  onExternalEvent: async (event) => {
    externalEvents.push(event);
  },
});

async function mockProcessExternals() {
  for (const event of externalEvents.splice(0)) {
    if (event.name === "fraud.score") {
      const output: ExternalOutputOf<typeof fraud> = {
        score: 42,
      };
      await fookie.setExternalResult({
        externalId: event.externalId,
        output,
      });
    }
    if (event.name === "notify.send") {
      const output: ExternalOutputOf<typeof notify> = {
        sent: true,
      };
      await fookie.setExternalResult({
        externalId: event.externalId,
        output,
      });
    }
  }
}

setInterval(mockProcessExternals, 1000);

fookie.run();

const userCreated = await fookie.create(user, {
  email: "test@example.com",
  name: "Test User",
});

const merchantCreated = await fookie.create(merchant, {
  site: "https://example.com",
  rating: 4.5,
});

if (userCreated.signal === Done && merchantCreated.signal === Done) {
  const orderCreated = await fookie.create(order, {
    buyer: userCreated.id,
    merchant: merchantCreated.id,
    amount: 100,
    score: 80,
    status: "confirmed",
  });

  if (orderCreated.signal === Done) {
    console.log(orderCreated.entity.createdAt);
  }
}

console.log(userCreated, merchantCreated);
