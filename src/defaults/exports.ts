import { store } from "./database/store";
import { text } from "./type/text";
import { integer } from "./type/integer";

export const defaults = {
    type: {
        integer,
        text,
    },
    database: {
        store,
    },
};
