import { test } from "vitest"
import { Model, defaults } from "../../src"
import { Exception, ExceptionType } from "../../src/core/exceptions"
import { Rule } from "../../src/core/lifecycle"
import { store } from "../../src/defaults/database/store"

test("Define a simple model with addException methods", async () => {
    class User extends Model {}

    User.addDatabase(store)

    User.addException(
        Exception.new({
            type: ExceptionType.ACCEPT,
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

    User.addException(
        Exception.new({
            type: ExceptionType.REJECT,
            role: defaults.role.nobody,
            execute: Rule.new({
                key: "reject-modify",
                execute: async function () {
                    return false
                },
            }),
        }),
    )

    await User.read()
})
