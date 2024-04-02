import { store } from "./database/store";
import { text } from "./type/text";
import { number } from "./type/number";

export const defaults = {
    type: {
        text,
        number,
    },
    database: {
        store,
    },
};
