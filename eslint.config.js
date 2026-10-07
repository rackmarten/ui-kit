import config from "@rackmarten/eslint-config/vue";

export default [
  ...config,
  { languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } } },
  {
    // vi.fn mocks and vi.spyOn results have no `this`, so asserting on them
    // as bare methods is safe.
    files: ["test/**"],
    rules: { "@typescript-eslint/unbound-method": "off" },
  },
];
