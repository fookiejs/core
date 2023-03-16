import { it, describe, assert } from "vitest"
import { run } from "../src"
import { model, models } from "../src/generators"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

@Model({ database: Store })
class User {
    @Field({ type: Text, required: true })
    name: string

    @Field({ type: Text, required: true })
    password: string
}

const res = run({
    model: User,
    method: Create,
    body: {
        name: "umut",
        password: "umut",
    },
})

const user = lodash.find(models, { name: "user" })
assert.equal(lodash.isObject(user), true)
