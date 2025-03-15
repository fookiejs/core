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
        alias: [
            {
                find: "@fookiejs/core",
                replacement: resolve(__dirname, "packages/core/src/index.ts"),
            },
        ],
    },
})
