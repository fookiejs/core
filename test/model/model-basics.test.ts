import { test } from "vitest"
import { Model } from "../../src"
import { Exception } from "../../src/core/exceptions"

test("Define a simple model", async () => {
    class User extends Model {
        email: string
    }
    User.read()
    User.read()

    User.exception.accepts(new Exception())
})
