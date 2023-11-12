import { ModelDictionary, DatabaseDictionary, MixinDictionary, LifecycleDictionary, TypeDictionary } from "../../types"

import { system, everybody, nobody } from "../lifecycle"
import { store } from "../database"
import { after, before } from "../mixin"
import { text, float, integer, boolean, buffer, plain, char, func, array, date_type, time, date_time, timestamp } from "../type"

class Dictionary {
    static Model: ModelDictionary = {}

    static Database: DatabaseDictionary = {
        store,
    }

    static Mixin: MixinDictionary = {
        before,
        after,
    }

    static Lifecycle: LifecycleDictionary = {
        system,
        everybody,
        nobody,
    }

    static Type: TypeDictionary = {
        text,
        float,
        integer,
        boolean,
        buffer,
        plain,
        char,
        func,
        array,
        date_type,
        time,
        date_time,
        timestamp,
    }
}
export { Dictionary }
