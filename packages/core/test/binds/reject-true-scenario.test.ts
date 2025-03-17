import { expect } from "jsr:@std/expect";
import { Model, Field, defaults, Modify, Rule } from "@fookiejs/core";

// Accept Lifecycle Function
const flag1 = { called: false };
const flag2 = { called: false };

const rejectModify = Modify.create({
  key: "reject_modify",
  execute: async function (payload) {
    flag1.called = true;
    payload.query.limit = 10;
  },
});

const rule_true = Rule.create({
  key: "rule_true",
  execute: async function () {
    flag2.called = true;
    return true;
  },
});

@Model.Decorator({
  database: defaults.database.store,
  binds: {
    read: {
      role: [defaults.role.nobody],
      rejects: [
        [
          defaults.role.nobody,
          {
            modify: [rejectModify],
            rule: [rule_true],
          },
        ],
      ],
    },
    create: {
      role: [],
    },
  },
})
class TrueQueryTextModel extends Model {
  @Field.Decorator({ type: defaults.type.string })
  textField!: string;
}

Deno.test("QueryTextModel Accept and Rule Lifecycle Tests", async () => {
  await TrueQueryTextModel.create({ textField: "abc" });
  await TrueQueryTextModel.create({ textField: "def" });
  await TrueQueryTextModel.create({ textField: "ghi" });

  Deno.test(
    "should call accept modify function and rule_true when admin role is accepted",
    async () => {
      flag1.called = false;
      flag2.called = false;

      const results = await TrueQueryTextModel.read({}, { sub: "admin" });
      expect(flag1.called).toBe(true);
      expect(flag2.called).toBe(true);
      expect(results).toHaveLength(3);
    }
  );
});

Deno.test("Bind", async () => {
  await TrueQueryTextModel.read({}, { sub: "admin" });
});
