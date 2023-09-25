import { run } from "./packages/run"
import * as Builder from "./packages/builder"
import * as Model from "./packages/model"
import * as Database from "./packages/database"
import * as Method from "./packages/method"
import * as Mixin from "./packages/mixin"
import * as Role from "./packages/role"
import * as Selection from "./packages/selection"
import * as Type from "./packages/type"
import * as Types from "./types/index"

async function use<T>(
    cb: (fookie: { Builder; Model; Database; Method; Mixin; Role; Selection; Type; Types; use; run }) => T
): Promise<T> {
    return await cb({ Builder, Model, Database, Method, Mixin, Role, Selection, Type, Types, use, run })
}

export { Builder, Model, Database, Method, Mixin, Role, Selection, Type, Types, use, run }
