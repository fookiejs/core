import { store } from "./database/store";
import { text } from "./type/text";
import { integer } from "./type/integer";
import { nobody } from "./role/nobody";
import { system } from "./role/system";
import { everybody } from "./role/everybody";
import { date } from "./type/date";
import { timestamp } from "./type/timestamp";
import { time } from "./type/time";
import { float } from "./type/float";
import { boolean } from "./type/boolean";

export const defaults = {
    type: {
        integer,
        text,
        date,
        timestamp,
        time,
        float,
        boolean,
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
