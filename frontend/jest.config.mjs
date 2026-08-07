import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/.next/"],
  // testPathIgnorePatterns only stops Jest running tests from .next/; haste
  // still crawls it. Since `output: standalone` writes a second package.json
  // to .next/standalone, that crawl reports a module naming collision on
  // every local run made after a build. CI never sees it — tests run before
  // the build there — which is exactly why it needs silencing here instead.
  modulePathIgnorePatterns: ["<rootDir>/.next/"],
};

export default createJestConfig(config);
