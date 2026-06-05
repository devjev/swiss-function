# Anatomy of a Coding Agent

A reference for the parts that make up an autonomous (or semi-autonomous)
software-engineering agent — independent of any specific implementation.
The goal is to give names to recurring concepts so design conversations
can use shared vocabulary.

A coding agent is, at its core, a **language model bolted to a runtime
that can read and write to a developer environment**. Everything else —
memory, planning, sub-agents, hooks, permissions — exists to make that
core loop more reliable, less expensive, or safer.

---

## 1. The model

The reasoning core. A frontier LLM that, given a context window of text,
produces a stream of text and/or structured tool calls.

Concerns:

- **Capability**: how well the model writes/reads code, plans, and follows
  instructions. Drives the ceiling of what the agent can do.
- **Output format**: text only, text + tool calls, or text + thinking +
  tool calls (extended reasoning). Each adds operational complexity in
  exchange for accuracy.
- **Context window size**: the maximum tokens the model can attend to.
  Modern models offer 200k–1M tokens; the harness must still budget
  carefully because cost and latency scale with usage.
- **Determinism**: temperature, sampling, and seeding. Agents usually run
  at low temperature, but never zero (small entropy unblocks loops).
- **Knowledge cutoff**: when the model's training data ends. The harness
  compensates via tools (web search, file reads) for anything newer.

The model is a stateless function: `(context) → (text, tool_calls)`. All
state lives in the harness.

---

## 2. The harness

The runtime that hosts the model. Responsibilities:

- **Driver loop**: feed context to the model, parse its response, execute
  any tool calls, append the results to context, repeat until the model
  emits a stop signal (no more tool calls, or an explicit "done").
- **Context assembly**: pick what goes into the prompt on each turn
  (system prompt, user message, prior turns, tool results, auto-injected
  memory). This is where most agent design lives in practice.
- **Tool dispatch**: route tool calls to handlers, format results back
  into something the model can consume.
- **Token budgeting**: monitor context usage; compact / summarize when
  approaching the window limit so long tasks don't fall off the end.
- **Cache management**: most providers offer prompt caching with a TTL
  (typically 5 minutes). The harness arranges turns so cache hits compound
  — system prompt and tool definitions stable, growing tail at the end.
- **Persistence**: spool turns to disk so a session can be resumed,
  reviewed, or replayed.

The harness is where opinionated choices show up: what counts as "one
turn", whether tool calls are parallelizable, when to auto-compact, what
to log.

---

## 3. Tools

The agent's hands. Each tool is a typed function the model can invoke;
the harness executes it and returns the result as text.

Common categories:

| Category        | Examples                                       | Notes                                                |
| --------------- | ---------------------------------------------- | ---------------------------------------------------- |
| Filesystem      | `Read`, `Write`, `Edit`, `Glob`                | The primitive surface for code work.                 |
| Shell           | `Bash`, `Exec`                                 | The escape hatch — also the riskiest.                |
| Search          | `Grep`, `Find`                                 | Cheap discovery; tools should bias toward these.     |
| Code intel      | LSP queries, AST tools, type checkers          | Lifts the agent above "grep and hope".               |
| Web             | `WebFetch`, `WebSearch`                        | For docs, APIs, anything outside the repo.           |
| Version control | `git status/diff/log/commit/push`              | Usually exposed via `Bash` rather than wrapped.      |
| Composition     | Sub-agents, parallel tasks                     | Tools that themselves invoke a model.                |
| External        | MCP servers, custom HTTP, IDE integrations     | Pluggable interfaces to other services.              |

Design choices that matter:

- **Tool granularity**: one `Bash` tool vs. a dozen single-purpose tools.
  Coarse tools are flexible but harder for the model to use safely; fine
  tools are predictable but inflate the tool schema and slow inference.
- **Result formatting**: structured (JSON) vs. terminal-style (lines of
  text). Terminal output tends to read better for LLMs because that's
  most of their training data.
- **Streaming**: long-running tools (test suites, builds) can stream
  output; the harness usually buffers and presents the tail.
- **Error semantics**: distinguish "tool failed" (model should retry or
  rethink) from "tool unavailable" (capability missing — model should
  give up cleanly).

---

## 4. Context

What the model sees on every turn. The single most important piece of
engineering in a coding agent.

A typical context window contains, in order:

1. **System prompt**: identity, persona, hard rules, output conventions.
   Stable across the session for cache efficiency.
2. **Tool definitions**: JSONSchema for every available tool. Often a few
   thousand tokens; also cache-stable.
3. **Project-loaded context**: auto-injected from files like `CLAUDE.md`
   or `AGENTS.md` at session start. Project-scoped instructions.
4. **Memory**: long-lived notes the agent has written to itself in prior
   sessions, surfaced selectively (see §5).
5. **Conversation turns**: alternating user / model / tool-result blocks.
   This is the only part that grows during the session.
6. **Tail**: the most recent user message and the model's pending reply.
   The freshest content sits at the cache boundary so it can change without
   busting upstream cache hits.

Effective context engineering means:

- **Include only what the model actually needs to make the next decision.**
  Excess context dilutes attention and inflates cost.
- **Put stable content first.** Provider caches are prefix-based; anything
  that changes invalidates everything after it.
- **Prefer pointers to payloads.** A grep result pointing at a file is
  usually better than the file's contents inlined.
- **Compact aggressively past the cache window** (~5 min on Anthropic).
  After that boundary you're paying full price anyway; trim hard.

---

## 5. Memory

What persists between sessions. Distinct from context (which is
per-conversation) and from project files (which the agent edits as a
side effect of its work).

Common shapes:

- **File-based memory**: the agent writes markdown files into a known
  directory (e.g. `~/.claude/memory/`). Loaded into context on session
  start. Simple, debuggable, version-controllable.
- **Indexed memory**: vector store of notes retrieved by semantic search.
  Scales better to large memory but adds complexity and recall failure
  modes.
- **Project memory** vs. **global memory**: project-scoped notes live
  alongside the repo; global notes follow the user across projects.

Memory types worth distinguishing:

- **User profile**: who you are, what you work on, how you like to
  collaborate.
- **Feedback / preferences**: corrections the user has given that the
  agent should honor in future sessions.
- **Project facts**: domain knowledge, why decisions were made, where
  things live in the codebase.
- **External references**: where to find things outside the repo
  (Linear board, Grafana dashboard, Slack channel).

The hard problem is **when to surface a memory** — loading everything
inflates context; loading nothing makes memory invisible. Most systems
either auto-load everything below a size threshold, or run a cheap
retrieval pass over the user's message.

---

## 6. Planning

How larger tasks get decomposed before execution.

Two patterns dominate:

- **Plan-then-execute**: a dedicated planning step produces a structured
  plan (markdown, JSON, or a task list). The agent then executes it
  step by step, updating progress as it goes. Good for tasks > 10 steps;
  the plan acts as durable scratchpad if the model loses focus.
- **Inline reasoning**: the agent decomposes the task implicitly inside
  each turn, without an explicit plan artifact. Lower overhead; works
  for short tasks (a few steps).

In either shape, a **task tracker** is useful: a list of pending /
in-progress / done items the harness presents to the model on every turn.
It costs a few hundred tokens and meaningfully reduces drift on long
sessions.

Plan mode (where the agent drafts a plan but is read-only until approved)
is a common safety pattern: the user can intervene before any destructive
work begins.

---

## 7. Loops & autonomy

What drives iteration.

- **The reasoning loop**: the basic harness loop — model emits tool
  calls, harness executes, results feed back, repeat. Single-step from
  the model's point of view; multi-step from the user's.
- **Background tasks**: the agent kicks off a long-running tool (CI run,
  build, log stream) and is notified on completion. Lets the agent
  continue other work in parallel.
- **Schedulers**: the agent can register itself to wake up later — fixed
  interval (cron) or dynamic delay (sleep N seconds then re-enter with
  the same prompt). Used for "watch this PR and react" or "check the
  deploy every 5 minutes" workflows.
- **Sub-agents** (see §9): a way to spawn a fresh reasoning loop with its
  own context, returning only a summary to the parent.

Autonomy boundary: a coding agent rarely runs fully unattended. Most
deployments draw a line at "may edit / read / run locally without asking,
must ask before pushing / messaging / deploying". The harness enforces
this through permissions (§8).

---

## 8. Permissions & sandboxing

What the agent is allowed to do without confirmation.

Layers, from coarse to fine:

1. **Mode** (one big switch):
   - *Read-only*: no edits, no shell, no network.
   - *Edit*: filesystem writes allowed; shell limited.
   - *Auto* / *YOLO*: everything pre-approved.
2. **Allowlists & denylists** per tool. Often glob-shaped:
   `Bash(npm:*)` for "any npm command", `Edit(src/**)` for "any file
   under src/".
3. **Per-call confirmation**: even allowed tools can prompt if the
   command matches a risky pattern (`rm -rf`, force pushes, schema
   migrations).
4. **Sandbox**: the harness runs shell commands in an isolated namespace
   (filesystem snapshot, network namespace, seccomp). Limits blast radius
   even when permission is granted.

Trade-off: the more friction the user accepts, the more the agent can
do unattended. Most teams converge on a generous local allowlist and
manual confirmation for anything that touches a shared system.

---

## 9. Extension points

How the agent is customized without touching its core.

- **Hooks**: shell commands the harness runs at lifecycle events
  (pre-tool-call, post-tool-call, on-stop, on-error). Used for
  notifications, audit logs, automated quality checks (e.g. "run
  formatter after every edit").
- **Slash commands / skills**: named recipes (markdown files, or short
  scripts) the user invokes by typing `/name`. Encapsulate repeatable
  workflows ("review this branch", "draft a PR description").
- **Sub-agents**: specialized agent definitions with their own system
  prompt, tool set, and (sometimes) model. Used for tasks that benefit
  from a different posture — code review, planning, exploration — or to
  protect the main context from being polluted by intermediate work.
- **MCP servers**: external processes that expose tools or resources
  via a standard protocol (Model Context Protocol). Lets third parties
  ship integrations (Linear, Slack, internal APIs) without forking the
  agent.
- **Provider extensions**: streaming, prompt caching, batch APIs, file
  uploads, citations, native tool use. These shape what the harness
  *can* do, even if the user-facing surface doesn't expose them directly.

---

## 10. Feedback loops

How the agent knows when its work is correct.

Without feedback, the agent guesses; with feedback, it iterates toward
correctness. Quality of feedback dominates output quality.

In rough order of value:

1. **Type checker** — instant, deterministic, catches most refactor
   regressions. Cheap to run every iteration.
2. **Linter / formatter** — surfaces style and easy mistakes. Often
   integrated as a post-edit hook.
3. **Unit tests** — pinpointed feedback per behavior. Best when the
   agent runs only the affected suite, not the whole tree.
4. **Integration / e2e tests** — slower, broader. Run before commit.
5. **Build** — confirms cross-module wiring. Slowest, most comprehensive.
6. **Human review** — final arbiter for taste and intent.

A well-tuned agent doesn't just run these — it interprets their output:
"failing tests in unrelated files = my change broke them; failing tests
only in files I touched = my change is incomplete".

Two anti-patterns to watch for:

- **Skipping the check**: --no-verify, disabling hooks, bypassing CI.
  Treat these as red flags, not workarounds.
- **Cargo-cult success**: claiming a feature works because the build
  passed. UI changes need to be exercised in a browser; runtime
  behaviour needs an actual run, not just a green tsc.

---

## Design tradeoffs

A few tensions show up everywhere:

- **Capability vs. cost**: a stronger model with more context is also
  more expensive per turn. Hybrid agents route easy tasks to a cheaper
  model and reserve the strong one for hard ones.
- **Autonomy vs. control**: more permission grants mean less friction
  but more blast radius. Most teams err toward friction at first and
  loosen as trust builds.
- **Generality vs. specificity**: one big agent that does everything
  vs. many narrow agents that compose. Narrow agents are easier to
  reason about; orchestrating them is its own engineering problem.
- **Memory vs. forgetting**: persistent memory makes the agent
  smarter over time but also lets bad assumptions calcify. Memory
  must be editable and auditable.
- **Latency vs. depth**: thinking / extended reasoning improves
  quality but doubles or triples turn time. Worth it for hard
  problems; overkill for trivial edits.

There is no global right answer to any of these. The design space is
large and the right point depends on what kind of work the agent is
meant to do, who's using it, and how much it costs to be wrong.
