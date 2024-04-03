import { defineConfig, loadEnv } from "vite";

export default () => {
    return defineConfig({
        test: {
            include: ["test/**/*.test.ts"],
            coverage: {
                provider: "istanbul", // or 'c8'
            },
        },
    });
};
