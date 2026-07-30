import { execSync } from "child_process";
execSync("node scripts/check/chain.mjs", { stdio: "inherit" });
