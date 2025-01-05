import { Exception } from "./exceptions"
import { Field } from "./field"
import { Lifecycle } from "./lifecycle"
import { Create, Delete, Read, Update } from "./method"

export class Model {
    static lifecycle = {
        [Create]: {
            [Lifecycle.Rule]: [],
            [Lifecycle.Role]: [],
            [Lifecycle.Modify]: [],
            [Lifecycle.Filter]: [],
            [Lifecycle.Effect]: [],
        },
        [Read]: {
            [Lifecycle.Rule]: [],
            [Lifecycle.Role]: [],
            [Lifecycle.Modify]: [],
            [Lifecycle.Filter]: [],
            [Lifecycle.Effect]: [],
        },
        [Update]: {
            [Lifecycle.Rule]: [],
            [Lifecycle.Role]: [],
            [Lifecycle.Modify]: [],
            [Lifecycle.Filter]: [],
            [Lifecycle.Effect]: [],
        },
        [Delete]: {
            [Lifecycle.Rule]: [],
            [Lifecycle.Role]: [],
            [Lifecycle.Modify]: [],
            [Lifecycle.Filter]: [],
            [Lifecycle.Effect]: [],
        },
    }

    static fields: Field[] = []
    static exception: {
        accepts: Exception[]
        rejects: Exception[]
    } = {
        accepts: [],
        rejects: [],
    }

    static create() {}
    static read() {}
    static update() {}
    static delete() {}
}
