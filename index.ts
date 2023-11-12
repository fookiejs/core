import { v4 } from "uuid"

if (!process.env.SYSTEM_TOKEN) {
    process.env.SYSTEM_TOKEN = v4()
}

import { run } from "./packages/run"
import * as Builder from "./packages/builder"
import * as Method from "./packages/method"
import * as Types from "./types/index"
import { Dictionary } from "./packages/dictionary"

async function use<T>(cb: (fookie: { Dictionary; Builder; Method; Types; use; run }) => T): Promise<T> {
    return await cb({ Dictionary, Builder, Method, Types, use, run })
}

export { Dictionary, Builder, Method, Types, use, run }
