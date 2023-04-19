import * as Core from "./packages/core"
import * as Database from "./packages/database"
import * as Decorator from "./packages/decorator"
import * as Method from "./packages/method"
import * as Mixin from "./packages/mixin"
import * as Role from "./packages/role"
import * as Selection from "./packages/selection"
import * as Type from "./packages/type"

export { Core, Database, Decorator, Method, Mixin, Role, Selection, Type, use }
async function use(
    cb: (fookie: {
        Core: typeof Core
        Database: typeof Database
        Decorator: typeof Decorator
        Method: typeof Method
        Mixin: typeof Mixin
        Role: typeof Role
        Selection: typeof Selection
        Type: typeof Type
    }) => any
) {
    return await cb({ Core, Database, Decorator, Method, Mixin, Role, Selection, Type })
}
