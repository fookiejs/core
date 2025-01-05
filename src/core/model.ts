import { Database } from "./database"
import { Exception } from "./exceptions"
import { Field } from "./field"
import { Lifecycle } from "./lifecycle"
import { Methods } from "./method"

export class Model {
    database: Database
    private lifecycle = {
        [Methods.CREATE]: {
            [Lifecycle.RULE]: [],
            [Lifecycle.ROLE]: [],
            [Lifecycle.MODIFY]: [],
            [Lifecycle.FILTER]: [],
            [Lifecycle.EFFECT]: [],
        },
        [Methods.READ]: {
            [Lifecycle.RULE]: [],
            [Lifecycle.ROLE]: [],
            [Lifecycle.MODIFY]: [],
            [Lifecycle.FILTER]: [],
            [Lifecycle.EFFECT]: [],
        },
        [Methods.UPDATE]: {
            [Lifecycle.RULE]: [],
            [Lifecycle.ROLE]: [],
            [Lifecycle.MODIFY]: [],
            [Lifecycle.FILTER]: [],
            [Lifecycle.EFFECT]: [],
        },
        [Methods.DELETE]: {
            [Lifecycle.RULE]: [],
            [Lifecycle.ROLE]: [],
            [Lifecycle.MODIFY]: [],
            [Lifecycle.FILTER]: [],
            [Lifecycle.EFFECT]: [],
        },
    }

    private fields: Field[] = []
    private exception: {
        accepts: Exception<Model>[]
        rejects: Exception<Model>[]
    } = {
        accepts: [],
        rejects: [],
    }

    static new(model: { database: Database }): Model {
        const instance = new this()
        instance.database = model.database
        return instance
    }

    create() {
        console.log("Default create method executed")
    }

    read() {
        console.log("Default read method executed")
    }

    update() {
        console.log("Default update method executed")
    }

    delete() {
        console.log("Default delete method executed")
    }

    addLifecycle(method: keyof typeof Methods, type: keyof typeof Lifecycle, handler: any) {
        this.lifecycle[method][type].push(handler)
    }

    addAcceptException(exception: Exception<Model>) {
        this.exception.accepts.push(exception)
    }

    addRejectException(exception: Exception<Model>) {
        this.exception.rejects.push(exception)
    }

    addField(field: Field) {
        this.fields.push(field)
    }
}
