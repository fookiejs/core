import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import { model, lifecycle, mixin, database } from "../packages/builder"
import { run } from "../packages/run"
import * as Database from "../packages/database"
import { Create, Read, Count, Delete, Test, Update } from "../packages/method"
import * as Type from "../packages/type"
import * as Mixin from "../packages/mixin"

it("database", async function () {
    let res = database({
        pk: "id",
        pk_type: Type.Text,
        connect: async function () {},
        disconnect: async function () {},
        modify: function (model) {},
    })
})
