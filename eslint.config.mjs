import typescript from "@typescript-eslint/eslint-plugin";
import typescriptParser from "@typescript-eslint/parser";

export default {
    files: ["src/**/*.ts"],
    languageOptions: {
        parser: typescriptParser,
        ecmaVersion: 2020,
        sourceType: "module",
    },
    plugins: {
        "@typescript-eslint": typescript,
    },
    rules: {
        ...typescript.configs["recommended"].rules,
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": [
            "error",
            { argsIgnorePattern: "^_", caughtErrors: "none" },
        ],
    },
};
