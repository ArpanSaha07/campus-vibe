// Local production preview for a standalone build.
//
// `next start` no longer works: with `output: standalone` in next.config.ts it
// boots, serves markup, and prints a warning that it is the wrong entrypoint —
// the failure mode is a page with no styles rather than an error, which is
// worse than not starting at all. The real server is .next/standalone/server.js.
//
// Next deliberately leaves static assets and public/ out of the standalone
// trace, so they have to be placed next to the server before it will serve a
// complete page. frontend/Dockerfile does the same two copies with COPY
// instructions; keep the two in step.

import { cpSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const standalone = ".next/standalone";

if (!existsSync(standalone)) {
  console.error(
    `${standalone} not found. Run \`npm run build\` first.`
  );
  process.exit(1);
}

cpSync(".next/static", `${standalone}/.next/static`, { recursive: true });
cpSync("public", `${standalone}/public`, { recursive: true });

// server.js binds process.env.HOSTNAME. Git Bash and some Windows shells
// export HOSTNAME as the machine name, so inheriting it silently binds the
// server to that interface alone and http://localhost:PORT is refused — while
// the startup banner still claims it is ready. Pin it unless asked otherwise.
const { status } = spawnSync(process.execPath, [`${standalone}/server.js`], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    HOSTNAME: process.env.NEXT_HOSTNAME ?? "127.0.0.1",
  },
});

process.exit(status ?? 1);
