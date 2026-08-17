import { Postgres } from "../../postgresql/src/index.ts";
import { Redis } from "../../redis/src/index.ts";

export const mockPg = Postgres("postgres://mock");

export { Postgres, Redis };
