import { store } from "./database/store"
import { string } from "./type/string"
import { nobody } from "./role/nobody"
import { system } from "./role/system"
import { everybody } from "./role/everybody"
import { date } from "./type/date"
import { number } from "./type/number"
import { boolean } from "./type/boolean"
import { array } from "./type/array"

export const defaults = {
    type: {
        string,
        date,
        number,
        boolean,
        array,
    },
    database: {
        store,
    },
    lifecycle: {
        nobody,
        system,
        everybody,
    },
}
