import { it, describe, assert } from "vitest"
import { model, run, models } from "../src"
import { Store } from "../src/databases"
import { Model, Field } from "../src/decorators"
import { Create, Read } from "../src/methods"
import { Text } from "../src/types"
import * as lodash from "lodash"

it("FOOKIE JS check core functions.", async function () {
    await fookie.init()
    if (!fookie.store) throw Error("")
    if (!run) throw Error("")
    if (!fookie.lifecycle) throw Error("")
    if (!fookie.database) throw Error("")
    if (!fookie.use) throw Error("")
    if (!fookie.model) throw Error("")
    if (!fookie.mixin) throw Error("")
    if (!fookie.setting) throw Error("")
})
