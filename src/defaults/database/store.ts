import { Database } from "../../core/database"
import * as Methods from "../../core/method"

export const store = Database.new({
    init: function (Model) {
        return {
            [Methods.CREATE]: async () => {
                const entity = new Model()
                entity.id
                return entity
            },
            [Methods.READ]: async () => {
                return []
            },
            [Methods.UPDATE]: async () => {
                return true
            },
            [Methods.DELETE]: async () => {
                return true
            },
        }
    },
})
