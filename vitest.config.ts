import { defineConfig } from "vitest/config"
import { resolve } from "path"

export default defineConfig({
    test: {
        globals: true,
        environment: "node",
        include: ["**/test/**/*.test.ts"],
        exclude: ["**/node_modules/**", "**/dist/**"],
    },
    resolve: {
        alias: {
            "@fookiejs/core": resolve(__dirname, "packages/core/src"),
        },
    },
})
