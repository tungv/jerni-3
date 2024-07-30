import { mock } from "bun:test";

mock.module("read-package-up", () => ({
  readPackageUpSync: () => ({
    packageJson: {
      name: "mock-client",
      version: "0.1.0",
    },
  }),
}));
