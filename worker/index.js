// Powers the website's Refresh button.
//   POST /api/refresh  -> asks GitHub to run the "Sync gallery" workflow (copies new files from Drive)
//   GET  /api/refresh  -> how that run is going, and whether it found anything new
// Everything else is the static site in ./site.
// Cloudflare Access sits in front of the whole site, so only signed-in teammates can reach this.

const GH = "https://api.github.com";

function gh(env, path, init = {}) {
  return fetch(`${GH}/repos/${env.GITHUB_REPO}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "planet-bos-gallery",
      ...(init.headers || {}),
    },
  });
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function latestRun(env) {
  const r = await gh(env, `/actions/workflows/${env.WORKFLOW_FILE}/runs?per_page=1&branch=${encodeURIComponent(env.GITHUB_BRANCH)}`);
  if (!r.ok) throw new Error(`GitHub runs: ${r.status}`);
  const run = (await r.json()).workflow_runs?.[0];
  return run ? { id: run.id, status: run.status, conclusion: run.conclusion, createdAt: run.created_at, event: run.event, url: run.html_url } : null;
}

// Did that run save new pictures? It commits "Gallery sync …" only when something changed.
async function runChangedSomething(env, run) {
  const r = await gh(env, `/commits?sha=${encodeURIComponent(env.GITHUB_BRANCH)}&per_page=5&since=${encodeURIComponent(run.createdAt)}`);
  if (!r.ok) return false;
  return (await r.json()).some((c) => (c.commit?.message || "").startsWith("Gallery sync"));
}

async function refresh(request, env) {
  if (!env.GITHUB_TOKEN || !env.GITHUB_REPO) return json({ error: "not-configured" }, 501);

  if (request.method === "POST") {
    const before = await latestRun(env);
    if (before && before.status !== "completed") return json({ state: "running", run: before });
    const r = await gh(env, `/actions/workflows/${env.WORKFLOW_FILE}/dispatches`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ref: env.GITHUB_BRANCH }),
    });
    if (r.status !== 204) return json({ error: "dispatch-failed", status: r.status, detail: await r.text() }, 502);
    return json({ state: "started", startedAt: new Date().toISOString(), previousRunId: before?.id ?? null });
  }

  if (request.method === "GET") {
    const run = await latestRun(env);
    if (!run) return json({ state: "none" });
    if (run.status !== "completed") return json({ state: "running", run });
    if (run.conclusion !== "success") return json({ state: "failed", run });
    return json({ state: "done", run, changed: await runChangedSomething(env, run) });
  }

  return json({ error: "method-not-allowed" }, 405);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/refresh") {
      try {
        return await refresh(request, env);
      } catch (e) {
        return json({ error: "github-unreachable", detail: String(e) }, 502);
      }
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "not-found" }, 404);
    return env.ASSETS.fetch(request);
  },
};
