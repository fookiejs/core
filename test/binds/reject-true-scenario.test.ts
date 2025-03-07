import { describe, it, expect } from "vitest"
import { Model, Field, defaults, Modify, Rule } from "../../src/exports"
import {} from "../../src/defaults/role/nobody"

// Accept Lifecycle Function
const flag1 = { called: false }
const flag2 = { called: false }

const rejectModify = Modify.new({
    key: "reject_modify",
    execute: async function (payload) {
        flag1.called = true
        payload.query.limit = 10
    },
})

const rule_true = Rule.new({
    key: "rule_true",
    execute: async function () {
        flag2.called = true
        return true
    },
})

@Model.Decorator({
    database: defaults.database.store,
    binds: {
        read: {
            role: [defaults.lifecycle.nobody],
            rejects: [
                [
                    defaults.lifecycle.nobody,
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
    textField!: string
}

describe("QueryTextModel Accept and Rule Lifecycle Tests", async () => {
    await TrueQueryTextModel.create({ textField: "abc" })
    await TrueQueryTextModel.create({ textField: "def" })
    await TrueQueryTextModel.create({ textField: "ghi" })

    it("should call accept modify function and rule_true when admin role is accepted", async () => {
        flag1.called = false
        flag2.called = false

        const results = await TrueQueryTextModel.read({}, { token: "admin" })
        expect(flag1.called).toBe(true)
        expect(flag2.called).toBe(true)
        expect(results).toHaveLength(3)
    })
})

describe("QueryTextModel Bind", async () => {
    it("Bind", async () => {
        await TrueQueryTextModel.read({}, { token: "admin" })
    })
})
