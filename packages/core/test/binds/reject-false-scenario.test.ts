import { expect } from "jsr:@std/expect"
import { defaults, Field, FookieError, Model, Modify, Rule } from "@fookiejs/core"

// Accept Lifecycle Function
const flag1 = { called: false }
const flag2 = { called: false }

const rejectModify = Modify.create({
  key: "reject_modify",
  execute: async function (payload) {
    flag1.called = true
    payload.query.limit = 10
  },
})

const rule = Rule.create({
  key: "rule",
  execute: async function () {
    flag2.called = true
    return false
  },
})

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
            rule: [rule],
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
  textField!: string
}

Deno.test("QueryTextModel Accept and Rule Lifecycle Tests", async () => {
  await TrueQueryTextModel.create({ textField: "abc" })
  await TrueQueryTextModel.create({ textField: "def" })
  await TrueQueryTextModel.create({ textField: "ghi" })

  Deno.test(
    "should call accept modify function and rule_true when admin role is accepted",
    async () => {
      flag1.called = false
      flag2.called = false

      const results = await TrueQueryTextModel.read({}, { sub: "admin" })
      expect(flag1.called).toBe(true)
      expect(flag2.called).toBe(true)
      expect(results instanceof FookieError).toBeTruthy()
    },
  )
})
