// Audit 4 regression suite for the traffic-monitor automation repo
// (A4-CI-02, A4-CI-08, A4-CI-09, A4-CI-10, A4-CI-11, A4-CI-16).
//
// The repository ships no package.json, so this runs directly:
//   node --test tests/*.test.mjs

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const read = (path) => readFileSync(join(ROOT, path), "utf8");
const actionYml = read("action.yml");
const README = read("README.md");
const workflow = read(".github/workflows/fetch_traffic.yml");
const gitignore = read(".gitignore");

const CANONICAL_SLUG = "ameyachopade/gitlytics-github-traffic-automation";
const RESOLVABLE_REF = "v1.2.0";

function parseMapping(text, key) {
  const lines = text.split(/\r?\n/);
  const start = lines.indexOf(`${key}:`);
  assert.notEqual(start, -1, `${key}: block exists`);
  const entries = {};
  let current = null;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (line && !/^\s/.test(line)) break;
    const entry = /^ {2}([A-Za-z0-9_-]+):\s*$/.exec(line);
    if (entry) {
      current = entry[1];
      entries[current] = {};
      continue;
    }
    const property = /^ {4}([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (property && current) {
      entries[current][property[1]] = property[2]
        .replace(/^['"]|['"]$/g, "")
        .trim();
    }
  }
  return entries;
}

// A4-CI-02 ---------------------------------------------------------------
test("A4-CI-02: every documented action reference uses the live slug and a real tag", () => {
  const surfaces = [README, actionYml, workflow].join("\n");

  assert.ok(
    surfaces.includes(`${CANONICAL_SLUG}@${RESOLVABLE_REF}`),
    "canonical slug pinned to a published tag",
  );
  assert.doesNotMatch(surfaces, /gitlytics-traffic-monitor-automation/);
  assert.doesNotMatch(surfaces, /gitlytics-action@/);
  assert.doesNotMatch(surfaces, /@main\b/);

  const uses = [
    ...surfaces.matchAll(/uses:\s*([^\s#]+)/g),
    ...surfaces.matchAll(/`uses:\s*([^\s`#]+)/g),
  ].map((match) => match[1]);

  for (const reference of uses) {
    if (reference === "./" || reference.startsWith("docker://")) continue;
    assert.match(
      reference,
      /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)?@[0-9a-f]{40}$|@v\d+\.\d+\.\d+$/,
      `${reference} is pinned to a SHA or an exact version`,
    );
  }

  // AF2-ACT-02 / AF2-ACT-05: when the advertised tag exists locally, the
  // action it ships must be byte-identical to the working tree. Before the
  // owner cuts v1.2.0 the tag is absent, so this gate is dormant; once it is
  // created, drift between the tag and the tree fails the suite.
  const tagExists = spawnSync(
    "git",
    ["rev-parse", "-q", "--verify", `refs/tags/${RESOLVABLE_REF}`],
    { cwd: ROOT },
  );
  if (tagExists.status === 0) {
    const tagged = spawnSync("git", ["show", `${RESOLVABLE_REF}:action.yml`], {
      cwd: ROOT,
      encoding: "utf8",
    });
    assert.equal(tagged.status, 0, `${RESOLVABLE_REF} contains action.yml`);
    assert.equal(
      tagged.stdout.replace(/\r\n/g, "\n").trim(),
      actionYml.replace(/\r\n/g, "\n").trim(),
      `${RESOLVABLE_REF} must ship the same action.yml as the working tree`,
    );
  }
});

// A4-CI-08 ---------------------------------------------------------------
test("A4-CI-08: token docs require read-only Administration and a preflight", () => {
  // AF2-ACT-04: GitHub's own API reference states the fine-grained
  // permission set for all four traffic endpoints is
  //   "Administration" repository permissions (read)
  // so the documentation must ask for READ, not write. Requesting write
  // would hand a third-party scheduled action destructive repository-admin
  // powers (rename / transfer / delete) that the tool never uses.
  assert.match(README, /Administration[^\n]*Read/);
  assert.match(README, /Metadata[^\n]*Read/);
  assert.match(actionYml, /Administration: Read/);
  assert.match(actionYml, /Metadata: Read/);
  assert.doesNotMatch(README, /Administration[^\n]*Read and write/);
  assert.doesNotMatch(README, /Administration[^\n]*Read-only/);
  assert.doesNotMatch(actionYml, /Administration: Read and write/);
  assert.doesNotMatch(actionYml, /read-only administration access/i);

  const preflight = actionYml.slice(
    actionYml.indexOf("Verify token permissions"),
    actionYml.indexOf("Set up Python"),
  );
  assert.match(preflight, /traffic\/views/);
  assert.match(preflight, /HTTP 401/);
  assert.match(preflight, /HTTP 403/);
  assert.match(preflight, /::error::/);
  assert.match(preflight, /Administration: Read/);
  assert.match(preflight, /repo.*scope/);
  // AF2-ACT-03: the preflight must prove the token can actually READ
  // traffic, not merely that the token is valid. Otherwise a token with
  // only "Metadata: Read" passes, every traffic call 403s, zero rows are
  // written and the job reports success.
  assert.match(preflight, /traffic\/views/);
  assert.match(preflight, /TRAFFIC_PROBE_OK/);
  assert.match(preflight, /Could not prove that TRAFFIC_TOKEN can read repository traffic/);
});

// A4-CI-09 ---------------------------------------------------------------
test("A4-CI-09: README inputs and schedule match action.yml and the workflow", () => {
  const inputs = parseMapping(actionYml, "inputs");
  assert.deepEqual(Object.keys(inputs).sort(), [
    "branch",
    "data_dir",
    "include_private",
    "metrics",
    "repository",
    "traffic_token",
  ]);

  assert.equal(inputs.metrics.default, "views clones referrers paths stars forks releases");
  assert.equal(inputs.data_dir.default, "data/");
  assert.equal(inputs.traffic_token.required, "true");

  const tableRows = README.split(/\r?\n/).filter((line) =>
    /^\|\s*`[a-z_]+`\s*\|/.test(line),
  );
  const documented = tableRows.map(
    (line) => /^\|\s*`([a-z_]+)`/.exec(line)[1],
  );
  for (const name of Object.keys(inputs)) {
    assert.ok(documented.includes(name), `README documents ${name}`);
  }

  assert.match(README, /views clones referrers paths stars forks releases/);
  assert.doesNotMatch(README, /`views clones stars forks`/);
  assert.doesNotMatch(README, /\*\/13/);
  assert.doesNotMatch(README, /every 13 days/i);

  const cron = /cron:\s*'([^']+)'/.exec(workflow)?.[1];
  assert.equal(cron, "0 17 1,8,15,22 * *");
  assert.ok(README.includes(cron), "README quotes the real cron expression");
  assert.match(README, /1st, 8th, 15th, and 22nd/);
  assert.match(workflow, /1st, 8th, 15th and 22nd/);
});

// A4-CI-10 ---------------------------------------------------------------
test("A4-CI-10: the Action exposes outputs, guards checkout, and sets timeouts", () => {
  const outputs = parseMapping(actionYml, "outputs");
  assert.deepEqual(Object.keys(outputs).sort(), ["changed", "data_dir"]);
  assert.equal(outputs.changed.value, "${{ steps.commit.outputs.changed }}");
  assert.equal(outputs.data_dir.value, "${{ steps.commit.outputs.data-dir }}");

  assert.match(actionYml, /id:\s*commit/);
  assert.match(actionYml, /echo "changed=false" >> "\$OUTPUTS"/);
  assert.match(actionYml, /echo "changed=(true|false)" >> "\$OUTPUTS"/);
  assert.match(actionYml, /git rev-parse --is-inside-work-tree/);
  assert.match(actionYml, /::error::The workspace is not a git repository/);

  assert.match(workflow, /timeout-minutes:\s*30/);
  const stepTimeouts = actionYml.match(/timeout-minutes:\s*\d+/g) ?? [];
  assert.ok(stepTimeouts.length >= 3, "long-running composite steps have timeouts");
  assert.ok(stepTimeouts.some((value) => /30|20/.test(value)));

  const outsideRepo = spawnSync("git", ["rev-parse", "--is-inside-work-tree"], {
    cwd: tmpdir(),
    encoding: "utf8",
  });
  // System tmpdir is outside any work tree on Linux, macOS, and Windows.
  if (outsideRepo.status !== 0) {
    assert.match(
      actionYml,
      /::error::The workspace is not a git repository\.[^\n]*actions\/checkout/,
    );
  }
});

// A4-CI-11 ---------------------------------------------------------------
test("A4-CI-11: temp files are ignored and only traffic CSVs are staged", () => {
  for (const pattern of [
    "*.tmp",
    ".tmp_export_*",
    ".venv/",
    "build/",
    "dist/",
    "__pycache__/",
  ]) {
    assert.ok(gitignore.includes(pattern), `.gitignore covers ${pattern}`);
  }

  assert.doesNotMatch(actionYml, /git add "\$INPUT_DATA_DIR"\s*$/m);
  assert.match(actionYml, /find "\$INPUT_DATA_DIR" -type f -name 'traffic_\*\.csv'/);

  const ignored = spawnSync(
    "git",
    ["check-ignore", "-q", "--no-index", "data/traffic_2026-11.csvABCD.tmp"],
    { cwd: ROOT },
  );
  assert.equal(ignored.status, 0, "temp sync file is ignored");

  const tracked = spawnSync(
    "git",
    ["check-ignore", "-q", "--no-index", "data/traffic_2026-11.csv"],
    { cwd: ROOT },
  );
  assert.notEqual(tracked.status, 0, "traffic CSV is not ignored");
});

// A4-CI-16 / AF2-ACT-05 ----------------------------------------------
test("A4-CI-16: the library version has one source of truth and no open pin", () => {
  // AF2-ACT-05: the old test hardcoded "gitlytics==0.7.2" in both the
  // assertion and action.yml, so a version bump had to be chased in two
  // places. The pin now lives in .gitlytics-version and the installer
  // reads it; a second literal in action.yml is a failure.
  const pinned = read(".gitlytics-version").trim();
  assert.match(pinned, /^\d+\.\d+\.\d+$/, "the pin is a semver");
  assert.match(actionYml, /VERSION_FILE="\$ACTION_PATH\/\.gitlytics-version"/);
  assert.match(actionYml, /gitlytics==\$VERSION/);
  assert.doesNotMatch(actionYml, /gitlytics==\d+\.\d+\.\d+/);
  assert.doesNotMatch(actionYml, /gitlytics>=/);
  assert.doesNotMatch(actionYml, /gitlytics~=/);
});

// Audit Final Regressions (AF-ACT-01 .. AF-ACT-05) -----------------------

test("AF-ACT-01: template workflow specifies repository: 'all' for Option B vault", () => {
  assert.match(workflow, /uses:\s*\.\/\s*\n\s*with:[\s\S]*repository:\s*['"]?all['"]?/);
});

test("AF-ACT-02: branch handling checks origin branch, avoids pull on new branch, and never uses stash pop || true", () => {
  assert.doesNotMatch(actionYml, /git stash pop \|\| true/);
  assert.match(actionYml, /git ls-remote --exit-code --heads origin "\$TARGET_BRANCH"/);
  assert.match(actionYml, /git diff --staged --quiet -- "\$INPUT_DATA_DIR"/);
  assert.match(actionYml, /gitlytics\.automation import _write_df_to_csv/);
  assert.match(actionYml, /--diff-filter=U/);
});

test("AF-ACT-03: preflight validates repos, probes /user for 'all', avoids double 000, and classifies 403/429", () => {
  const preflight = actionYml.slice(
    actionYml.indexOf("Verify token permissions"),
    actionYml.indexOf("Set up Python"),
  );
  assert.doesNotMatch(preflight, /\|\|\s*echo\s+"000"/);
  assert.match(preflight, /https:\/\/api\.github\.com\/user/);
  assert.match(preflight, /RUNNER_TEMP:-/);
  assert.match(preflight, /--connect-timeout/);
  assert.match(preflight, /429\)/);
  assert.match(preflight, /x-ratelimit-remaining/i);
  assert.match(preflight, /User-Agent:/);
});

test("AF-ACT-04: sync validates data_dir, repository, metrics tokens, and preserves metadata columns for default metrics", () => {
  const syncBlock = actionYml.slice(
    actionYml.indexOf("Sync Traffic Data"),
    actionYml.indexOf("Commit and Push Historical Vaults"),
  );
  assert.match(syncBlock, /INPUT_DATA_DIR.*==\s*\/\*|~\*|\[A-Za-z\]:/);
  // AF2-ACT-09: the metrics are validated against the library's real
  // allow-list (so a typo is rejected instead of silently dropping a
  // metric), and the default is compared as a SET (so the same metrics in a
  // different order do not silently drop the repository metadata columns).
  assert.match(syncBlock, /ALLOWED_METRICS="[^"]*views[^"]*referrers[^"]*"/);
  assert.match(syncBlock, /Unknown metric/);
  assert.match(syncBlock, /DEFAULT_METRICS=\(views clones referrers paths stars forks releases\)/);
  assert.match(syncBlock, /IS_DEFAULT/);
  assert.doesNotMatch(syncBlock, /DEFAULT_METRICS_STR/);
});

test("AF-ACT-05: lockfiles & .env.* are ignored, CI workflow exists, and orphaned thumbnail is removed", () => {
  const lockIgnored = spawnSync(
    "git",
    ["check-ignore", "-q", "--no-index", "data/traffic_2026-11.csv.lock"],
    { cwd: ROOT },
  );
  assert.equal(lockIgnored.status, 0, "*.lock must be ignored");
  const envExampleIgnored = spawnSync(
    "git",
    ["check-ignore", "-q", "--no-index", ".env.example"],
    { cwd: ROOT },
  );
  assert.notEqual(envExampleIgnored.status, 0, ".env.example must not be ignored");

  const ciYml = read(".github/workflows/ci.yml");
  assert.match(ciYml, /pull_request:/);
  assert.match(ciYml, /node --test tests\/\*\.test\.mjs/);
  assert.equal(
    existsSync(join(ROOT, "assets", "traffic_automation_thumbnail_2.png")),
    false,
    "orphaned thumbnail removed",
  );

  // Every line inside action.yml's `run: |` blocks must stay indented so YAML parses cleanly.
  const lines = actionYml.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\s*run:\s*\|/.test(lines[i])) {
      const baseIndent = lines[i].match(/^(\s*)/)[1].length;
      for (let j = i + 1; j < lines.length; j += 1) {
        if (!lines[j].trim()) continue;
        const curIndent = lines[j].match(/^(\s*)/)[1].length;
        if (curIndent <= baseIndent) {
          assert.ok(
            /^[A-Za-z0-9_-]+:/.test(lines[j].trim()) || /^-\s/.test(lines[j].trim()),
            `action.yml line ${j + 1} broke out of YAML block scalar: ${lines[j]}`,
          );
          break;
        }
      }
    }
  }
});

// AF2-ACT-14 ---------------------------------------------------------------
test("AF2-ACT-14: the composite-action contract is asserted, not just the indentation", () => {
  // A composite action step that uses `run:` MUST declare `shell:` -
  // removing it fails the action at runtime with
  // "Required property is missing: shell", but the old suite stayed green.
  const stepBlocks = actionYml.split(/\r?\n\s*-\s+name:/).slice(1);
  assert.ok(stepBlocks.length >= 3, "action.yml declares at least three steps");
  for (const block of stepBlocks) {
    if (/^\s*run:/m.test(block) || /\n\s*run:/m.test(block)) {
      assert.match(
        block,
        /\n\s*shell:\s*\S+/,
        `a step with a run: body must declare shell:\n${block.slice(0, 200)}`,
      );
    }
  }

  // Every documented output must reference a step id that exists.
  const stepIds = new Set();
  for (const match of actionYml.matchAll(/^\s*-\s+name:\s*(.+)$/gm)) {
    stepIds.add(match[1].trim());
  }
  const idMatches = [...actionYml.matchAll(/^\s*id:\s*([A-Za-z0-9_-]+)/gm)].map((m) => m[1]);
  for (const id of idMatches) stepIds.add(id);

  const outputsBlock = actionYml.split(/^outputs:/m)[1] || "";
  const outputValues = [...outputsBlock.matchAll(/value:\s*\$\{\{\s*steps\.([A-Za-z0-9_-]+)/g)].map(
    (m) => m[1],
  );
  assert.ok(outputValues.length > 0, "action.yml declares at least one output");
  for (const stepId of outputValues) {
    assert.ok(
      stepIds.has(stepId),
      `output references step id "${stepId}" which does not exist in action.yml`,
    );
  }

  // branding is mandatory for a valid action.yml.
  assert.match(actionYml, /^\s*icon:\s*\S+/m, "branding.icon is declared");
  assert.match(actionYml, /^\s*color:\s*\S+/m, "branding.color is declared");

  // Every input must document itself.
  const inputsBlock = actionYml.split(/^inputs:/m)[1]?.split(/^outputs:/m)[0] || "";
  const inputNames = [...inputsBlock.matchAll(/^\s{2}([A-Za-z0-9_]+):/gm)].map((m) => m[1]);
  assert.ok(inputNames.length >= 3, "action.yml declares at least three inputs");
  for (const name of inputNames) {
    const block = inputsBlock.split(new RegExp(`^\\s{2}${name}:`, "m"))[1] || "";
    assert.match(block, /description:\s*\S+/, `input "${name}" has a description`);
  }

  // The action must be a composite action.
  assert.match(actionYml, /^\s*using:\s*'composite'/m, "runs.using is composite");
});

// AF2-ACT-12 / AF2-ACT-13 / AF2-ACT-11 ---------------------------
test("AF2-ACT-12/13/11: the workflows keep credentials out of git, archive the vault and never interpolate expressions into a run: body", () => {
  const ciYml = read(".github/workflows/ci.yml");

  // AF2-ACT-12: the read-only CI job must not leave the GITHUB_TOKEN in .git/config.
  assert.match(
    ciYml,
    /persist-credentials:\s*false/,
    "the CI checkout must set persist-credentials: false",
  );

  // AF2-ACT-13: the synced CSVs must survive a failed push as an artifact.
  assert.match(
    workflow,
    /actions\/upload-artifact@[0-9a-f]{40}/,
    "the workflow uploads the traffic vault as a SHA-pinned artifact",
  );
  assert.match(workflow, /retention-days:\s*\d+/, "the artifact has a retention window");

  // AF2-ACT-11: no `${{ }}` may appear inside a `run:` body - GitHub
  // substitutes it into the SCRIPT TEXT before the shell parses it, so a
  // shell metacharacter in the value executes on the runner.
  const lines = workflow.split(/\r?\n/);
  let inRun = false;
  let runIndent = 0;
  for (const line of lines) {
    if (/^\s*run:\s*\|/.test(line)) {
      inRun = true;
      runIndent = line.match(/^(\s*)/)[1].length;
      continue;
    }
    if (inRun) {
      if (!line.trim()) continue;
      const indent = line.match(/^(\s*)/)[1].length;
      if (indent <= runIndent) {
        inRun = false;
        continue;
      }
      assert.doesNotMatch(
        line,
        /\$\{\{/,
        `a run: body must not interpolate an expression directly: ${line}`,
      );
    }
  }
});

// AF2-ACT-06 ---------------------------------------------------------------
test("AF2-ACT-06: transient failures retry with backoff and the schedule keeps a 7-day margin", () => {
  const preflight = actionYml.slice(
    actionYml.indexOf("Verify token permissions"),
    actionYml.indexOf("Set up Python"),
  );
  assert.match(preflight, /retryable_status\s*\(\)/);
  assert.match(preflight, /backoff_sleep\s*\(\)/);
  assert.match(preflight, /429\|500\|502\|503\|504/);
  assert.match(preflight, /is_rate_limited_403/);
  assert.match(preflight, /attempt.*\/3/);

  const sync = actionYml.slice(
    actionYml.indexOf("Sync Traffic Data"),
    actionYml.indexOf("Commit and Push Historical Vaults"),
  );
  assert.match(sync, /SYNC_ATTEMPT/);
  assert.match(sync, /non-retryable/);
  assert.match(sync, /PIPESTATUS\[0\]/);
  assert.match(sync, /sleep "\$SYNC_DELAY"/);

  const cron = /cron:\s*'([^']+)'/.exec(workflow)?.[1];
  assert.equal(cron, "0 17 1,8,15,22 * *");
  assert.match(workflow, /7-day/i);
});

// AF2-ACT-07 ---------------------------------------------------------------
test("AF2-ACT-07: every third-party runtime dependency is hash-pinned", () => {
  const requirements = read("requirements.txt");
  assert.match(requirements, /^--only-binary=:all:$/m);

  const entries = requirements
    .split(/\r?\n/)
    .filter((line) => /^[a-z0-9-]+==\d+(?:\.\d+)+/.test(line));
  assert.ok(entries.length >= 10, `expected the full dependency set, saw ${entries.length}`);
  for (const entry of entries) {
    const name = entry.split("==")[0];
    const index = requirements.indexOf(entry);
    assert.match(
      requirements.slice(index, index + 500),
      /--hash=sha256:[0-9a-f]{64}/,
      `${name} must carry a SHA-256 hash`,
    );
  }

  assert.match(actionYml, /--require-hashes -r "\$ACTION_PATH\/requirements\.txt"/);
  assert.match(actionYml, /--no-deps "gitlytics==\$VERSION"/);
});

// AF2-ACT-08 ---------------------------------------------------------------
test("AF2-ACT-08: private repositories are opt-in when repository is 'all'", () => {
  const inputs = parseMapping(actionYml, "inputs");
  assert.equal(inputs.include_private.default, "false");

  const sync = actionYml.slice(
    actionYml.indexOf("Sync Traffic Data"),
    actionYml.indexOf("Commit and Push Historical Vaults"),
  );
  assert.match(sync, /INPUT_INCLUDE_PRIVATE/);
  assert.match(sync, /--public-only/);
  // Explicit owner/repo entries must never be filtered.
  assert.match(sync, /if \[ -n "\$REPO_CLEAN" \] && \[ "\$REPO_CLEAN" != "all" \]/);

  assert.match(workflow, /include_private:\s*['"]false['"]/);
  assert.match(README, /include_private/);
  assert.match(README, /Private repositories are opt-in/i);
});
