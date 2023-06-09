import * as Core from "./packages/core"
import * as Database from "./packages/database"
import * as Decorator from "./packages/decorator"
import * as Method from "./packages/method"
import * as Mixin from "./packages/mixin"
import * as Role from "./packages/role"
import * as Selection from "./packages/selection"
import * as Type from "./packages/type"
import { Fookie } from "fookie-types"

export { Core, Database, Decorator, Method, Mixin, Role, Selection, Type, use }

async function use<T>(cb: (fookie: Fookie) => T): Promise<T> {
    return await cb({ Core, Database, Decorator, Method, Mixin, Role, Selection, Type })
}
