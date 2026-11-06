// Reuse the guarded local launcher; no hosted/operator credentials reach the web process.
process.env.S5_ENABLED = "true";
await import("./s4-app.mjs");
