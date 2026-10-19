import typescript_eslint from "typescript-eslint";
import react_hooks from "eslint-plugin-react-hooks";

export default typescript_eslint.config(
  { ignores: ["**/dist/**", "**/target/**", "**/public/**", "**/src-tauri/gen/**"] },
  ...typescript_eslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { "react-hooks": react_hooks },
    rules: {
      ...react_hooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      "max-lines": ["error", { max: 700, skipBlankLines: true, skipComments: true }],
      // Project rule: readable names only, no single letters except coordinates.
      "id-length": ["error", { min: 2, properties: "never", exceptions: ["x", "y", "z", "w", "_"] }],
      "@typescript-eslint/naming-convention": [
        "error",
        { selector: "default", format: ["snake_case"], leadingUnderscore: "allow" },
        // React only recognizes hooks named useSomething, so hooks are the one camelCase exception.
        { selector: ["variable", "function"], filter: { regex: "^use[A-Z]", match: true }, format: ["camelCase"] },
        { selector: "variable", filter: { regex: "^__[A-Z_]+__$", match: true }, format: null },
        { selector: "variable", format: ["snake_case", "UPPER_CASE", "PascalCase"], leadingUnderscore: "allow" },
        { selector: "function", format: ["snake_case", "PascalCase"] },
        { selector: "typeLike", format: ["PascalCase"] },
        { selector: "enumMember", format: ["PascalCase", "snake_case"] },
        { selector: "import", format: null },
        // Object keys follow external contracts (ARKit names, DOM, PixiJS, React props).
        { selector: ["property", "method", "accessor"], format: null },
      ],
    },
  },
);
