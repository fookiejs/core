import { run } from "./packages/run"
import * as Builder from "./packages/builder"
import * as Model from "./packages/dictionary"
import * as Database from "./packages/database"
import * as Method from "./packages/method"
import * as Mixin from "./packages/mixin"
import * as Role from "./packages/role"
import * as Selection from "./packages/selection"
import * as Type from "./packages/type"
import * as Types from "./types/index"
import Dictionary from "./packages/dictionary"

async function use<T>(
    cb: (fookie: { Dictionary; Builder; Model; Database; Method; Mixin; Role; Selection; Type; Types; use; run }) => T
): Promise<T> {
    return await cb({ Dictionary, Builder, Model, Database, Method, Mixin, Role, Selection, Type, Types, use, run })
}

export { Dictionary, Builder, Model, Database, Method, Mixin, Role, Selection, Type, Types, use, run }
