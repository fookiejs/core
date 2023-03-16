import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("Relation has_entity", async function () {
    const assert = require("assert")
    const fookie = require("../src/index")
    const lodash = require("lodash")

    await fookie.init()
    let res = await run({
        token: "system_token",
        model: "model",
        method: "create",
        body: {
            name: "relation_test",
            database: Store,
            schema: {
                model: {
                    relation: "model",
                    require: true,
                },
            },
            lifecycle: {},
            mixins: [],
        },
    })

    res = await run({
        model: "relation_test",
        method: "create",
        body: {
            model: "not_existed_model_has_entity",
        },
    })
    assert.equal(res.status, false)
})
