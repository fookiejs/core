import { store } from "./database/store";
import { text } from "./type/text";
import { integer } from "./type/integer";
import { nobody } from "./role/nobody";
import { system } from "./role/system";
import { everybody } from "./role/everybody";

export const defaults = {
    type: {
        integer,
        text,
    },
    database: {
        store,
    },
    lifecycle: {
        nobody,
        system,
        everybody,
    },
};
