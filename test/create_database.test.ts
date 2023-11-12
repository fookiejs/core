import * as lodash from "lodash"
import { it, describe, assert } from "vitest"
import * as Fookie from "../index"

it("database", async function () {
    let res = Fookie.Builder.database({
        pk: "id",
        pk_type: Fookie.Dictionary.Type.text,
        connect: async function () {},
        disconnect: async function () {},
        modify: function (model) {},
    })
})
