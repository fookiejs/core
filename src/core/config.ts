import { v4 } from "uuid";

export class Config {
    private static env: Record<string, string> = {};

    static {
        for (const key in process.env) {
            if (process.env.hasOwnProperty(key)) {
                this.env[key] = process.env[key] as string;
            }
        }

        if (!this.env.hasOwnProperty("SYSTEM_TOKEN")) {
            this.env["SYSTEM_TOKEN"] = v4();
        }
    }

    static get(key: string): string {
        if (!this.env.hasOwnProperty(key)) {
            throw new Error(`Environment variable ${key} not found`);
        }
        return this.env[key];
    }
}
