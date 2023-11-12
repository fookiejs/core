import { v4 } from "uuid"

if (!process.env.SYSTEM_TOKEN) {
    process.env.SYSTEM_TOKEN = v4()
}

import { run } from "./packages/run"
import * as Builder from "./packages/builder"
import * as Database from "./packages/database"
import * as Method from "./packages/method"
import * as Mixin from "./packages/mixin"
import * as Type from "./packages/type"
import * as Types from "./types/index"
import * as Dictionary from "./packages/dictionary"
import * as Lifecycle from "./packages/lifecycle"

async function use<T>(
    cb: (fookie: { Dictionary; Lifecycle; Builder; Database; Method; Mixin; Type; Types; use; run }) => T
): Promise<T> {
    return await cb({ Dictionary, Lifecycle, Builder, Database, Method, Mixin, Type, Types, use, run })
}

export { Dictionary, Lifecycle, Builder, Database, Method, Mixin, Type, Types, use, run }
