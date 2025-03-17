import { store } from "./database/store.ts";
import { string } from "./type/string.ts";
import { nobody } from "./role/nobody.ts";
import { system } from "./role/system.ts";
import { everybody } from "./role/everybody.ts";
import { date } from "./type/date.ts";
import { number } from "./type/number.ts";
import { boolean } from "./type/boolean.ts";
import { array } from "./type/array.ts";

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
  role: {
    nobody,
    system,
    everybody,
  },
  feature: {
    required: Symbol(),
    unique: Symbol(),
  },
};
