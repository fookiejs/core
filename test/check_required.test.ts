import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"
import * as Role from "../packages/role"

it("async effect", async function () {
    const cr_model = await model({
        name: "cr_model",
        database: Database.Store,
        schema: {
            fieid: {
                type: Type.Text,
                required: true,
            },
        },
        bind: {
            test: {},
            create: {},
        },
    })

    const response = await run({
        model: cr_model,
        method: Create,
        body: {},
    })

    assert.equal(response.status, false)
    assert.equal(response.error, "check_required")
})
