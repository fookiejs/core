import { v4 } from "uuid"
import * as lodash from "lodash"
export class Config {
    private static env: Record<string, string> = {}

    static {
        for (const key in process.env) {
            if (lodash.has(process.env, key)) {
                this.env[key] = process.env[key] as string
            }
        }

        if (!lodash.has(this.env, "SYSTEM_TOKEN")) {
            this.env["SYSTEM_TOKEN"] = v4()
        }
    }

    static get(key: string): string {
        if (!lodash.has(this.env, key)) {
            throw new Error(`Environment variable ${key} not found`)
        }
        return this.env[key]
    }
}
