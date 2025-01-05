import { test } from "vitest"
import { Database, Model, defaults } from "../../src"
import { Exception } from "../../src/core/exceptions"
import { Rule } from "../../src/core/lifecycle"

test("Define a simple model with addException methods", async () => {
    const User = Model.new({
        database: Database.new({}),
    })

    await User.read()

    User.addAcceptException(
        Exception.new({
            role: defaults.role.everybody,
            execute: Rule.new({
                key: "test-modify",
                execute: async function (payload) {
                    payload.body
                    return true
                },
            }),
        }),
    )

    User.addRejectException(
        Exception.new({
            role: defaults.role.everybody,
            execute: Rule.new({
                key: "reject-modify",
                execute: async function () {
                    return false
                },
            }),
        }),
    )
})
