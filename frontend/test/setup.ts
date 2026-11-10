// Lit's development build warns once that it is in dev mode; tests are meant to run on it.
(globalThis as { litIssuedWarnings?: Set<string> }).litIssuedWarnings = new Set(["dev-mode"]);
