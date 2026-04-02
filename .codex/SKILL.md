---
name: codex-agentic-agent
description: >
  A disciplined agentic skill for autonomous task execution. Use this skill whenever an agent needs
  to: capture app screenshots using Playwright (installing it automatically if absent), deeply
  understand the full context and structure of any prompt before taking any action, track its own
  progress in a progress markdown file, operate in strict step-by-step fashion, and consult a
  mistakes log to learn from prior errors. Trigger this skill whenever the agent is doing any
  multi-step autonomous task, visual capture/screenshot workflow, UI automation, or self-improving
  agentic loop. All state files live in the `.codex/` folder.
---

# Codex Agentic Agent Skill

A self-aware, self-correcting, step-by-step agentic execution framework. The agent captures app
screenshots via Playwright, tracks its own progress, and actively learns from its past mistakes —
all managed inside the `.codex/` folder.

---

## 0. Guiding Principles (Read First, Always)

Before doing **anything**, the agent commits to these principles:

1. **Understand before acting.** Never execute a step without first reading and internalizing the
   full prompt, its structure, its intent, and its constraints.
2. **Step-by-step execution.** Complete one step fully before starting the next. Never skip ahead.
3. **Progress is sacred.** Every meaningful action — start, decision, completion, failure — is
   logged to `.codex/progress.md` immediately after it happens.
4. **Mistakes are teachers.** Before beginning any new task or sub-task, read `.codex/mistakes.md`
   and apply its lessons proactively.
5. **Screenshots are evidence.** Visual captures of the app state are taken at key moments and
   stored as proof of progress.

---

## 1. Folder Structure

All agent state lives under `.codex/` in the project root:

```
.codex/
├── SKILL.md         ← This file (the agent's operating manual)
├── progress.md      ← Running log of what has been done and what is next
├── mistakes.md      ← Catalogue of past errors and how to avoid them
└── screenshots/     ← Playwright-captured images, named by step and timestamp
```

On first run, the agent creates this folder and all files if they do not exist.

```bash
mkdir -p .codex/screenshots
touch .codex/progress.md .codex/mistakes.md
```

---

## 2. Phase 0 — Context Ingestion (ALWAYS the first phase)

> **Rule:** The agent must never write code, run commands, or make decisions until Phase 0 is
> complete.

### 2.1 Read the full prompt

Read the entire user prompt from beginning to end. Do not skim.

### 2.2 Decompose the prompt

Extract and explicitly state:

- **Goal**: What is the end state that constitutes success?
- **Scope**: What is in scope and what is explicitly or implicitly out of scope?
- **Constraints**: Time limits, technology choices, file paths, environment restrictions.
- **Ambiguities**: Any part of the prompt that could be interpreted in more than one way.
- **Dependencies**: Tools, packages, services, or files that must exist before tasks can proceed.

### 2.3 Resolve ambiguities

If any ambiguity cannot be resolved from context alone, log it in `progress.md` under a
`## Unresolved` section and ask the user before proceeding.

### 2.4 Build the execution plan

Write a numbered list of steps — the full execution plan — into `progress.md` before starting
execution. Each step must have:

- A clear action
- Expected output or artifact
- A success criterion

### 2.5 Check mistakes.md

Read `.codex/mistakes.md` in full. For each past mistake, check whether the current task is at
risk of repeating it. If so, annotate the relevant step in the plan with a `⚠️ Watch:` note.

---

## 3. Phase 1 — Environment Setup

### 3.1 Playwright installation check

Before running any screenshot capture, verify Playwright is available:

```bash
npx playwright --version 2>/dev/null || echo "NOT_FOUND"
```

If not found, install it:

```bash
npm install playwright
npx playwright install chromium
```

Log the install result to `progress.md`.

### 3.2 App / target reachability

Confirm the target app or URL the agent needs to screenshot is accessible:

```bash
curl -o /dev/null -s -w "%{http_code}" <TARGET_URL>
```

If the app is a local server, check the process or start it before proceeding. Log status.

---

## 4. Phase 2 — Step-by-Step Execution

The agent executes the plan from `progress.md` one step at a time.

### 4.1 Step lifecycle

For every step:

1. **Mark as In Progress** in `progress.md`:
   ```
   - [ ] 🔄 Step N: <description> — started <timestamp>
   ```
2. **Execute** the action.
3. **Verify** the success criterion.
4. **Mark as Done** (or Failed):
   ```
   - [x] ✅ Step N: <description> — completed <timestamp>
   ```
   or
   ```
   - [ ] ❌ Step N: <description> — FAILED <timestamp> — see mistakes.md
   ```
5. If failed, go to **Phase 3** (Mistake Logging) before retrying or moving on.

### 4.2 Screenshot capture

Screenshots are taken at every major state transition of the app:

```javascript
// playwright-screenshot.js
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(process.env.TARGET_URL || 'http://localhost:3000');
  await page.waitForLoadState('networkidle');

  const label   = process.env.STEP_LABEL   || 'step';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename  = `.codex/screenshots/${label}_${timestamp}.png`;

  await page.screenshot({ path: filename, fullPage: true });
  console.log(`Screenshot saved: ${filename}`);
  await browser.close();
})();
```

Run it as:

```bash
STEP_LABEL="step-03-login" TARGET_URL="http://localhost:3000/login" node .codex/playwright-screenshot.js
```

Log the screenshot path in `progress.md` under the relevant step.

### 4.3 Never skip steps

If a later step seems simpler or more urgent, the agent resists the impulse to jump ahead.
Dependencies between steps are real even when not explicit. Sequence matters.

---

## 5. Phase 3 — Mistake Logging

Whenever a step fails, produces unexpected output, or requires a correction:

### 5.1 Document the mistake immediately

Append to `.codex/mistakes.md`:

```markdown
## Mistake: <short title>
- **Date**: <ISO timestamp>
- **Step**: Step N — <step description>
- **What happened**: <factual description of what went wrong>
- **Root cause**: <why it happened — be specific>
- **Impact**: <what had to be redone or what was lost>
- **Fix applied**: <what the agent did to correct it>
- **Prevention rule**: <a concrete rule to avoid this in the future>
```

### 5.2 Apply the fix

Correct the failed step. Re-run it. Re-take any affected screenshots. Update `progress.md`.

### 5.3 Update the execution plan if needed

If the mistake revealed a flaw in the plan (missing step, wrong order, wrong assumption),
update the plan in `progress.md` and note the revision:

```
> ⚠️ Plan revised at <timestamp> due to: <reason>
```

---

## 6. progress.md Format

`progress.md` is the single source of truth for where the agent is at any point in time.

```markdown
# Task Progress

## Task
<One-line summary of the overall goal>

## Started
<ISO timestamp>

## Execution Plan
- [ ] Step 1: <action> → <success criterion>
- [ ] Step 2: <action> → <success criterion>
- [ ] Step 3: ...

## Log

### <ISO timestamp> — Phase 0 complete
Prompt fully parsed. N ambiguities found. N resolved. Execution plan written.
mistakes.md reviewed — N past mistakes noted. Watch notes applied to steps: N, N.

### <ISO timestamp> — Step 1 started
<Brief note>

### <ISO timestamp> — Step 1 complete
Screenshot: `.codex/screenshots/step-01_<ts>.png`

### <ISO timestamp> — Step 2 FAILED
See mistakes.md: "Mistake: <title>"

### <ISO timestamp> — Step 2 retried and complete

## Status
IN PROGRESS | COMPLETE | BLOCKED

## Unresolved
- <list any ambiguities waiting on user input>
```

---

## 7. mistakes.md Format

`mistakes.md` is the agent's long-term memory of what not to do.

```markdown
# Mistakes Log

> This file is read at the start of every task and before every major decision.
> Each entry is a permanent lesson. Do not delete entries.

## Mistake: <title>
- **Date**: ...
- **Step**: ...
- **What happened**: ...
- **Root cause**: ...
- **Impact**: ...
- **Fix applied**: ...
- **Prevention rule**: ...

---
```

---

## 8. Task Completion Checklist

Before declaring a task complete, the agent verifies:

- [ ] All steps in `progress.md` are marked `✅`
- [ ] At least one screenshot exists per major app state transition
- [ ] `progress.md` status is updated to `COMPLETE` with a final timestamp
- [ ] `mistakes.md` has entries for every failure that occurred during the task
- [ ] No `Unresolved` items remain in `progress.md`
- [ ] The agent can state, in plain language, what was accomplished and what artifacts were produced

---

## 9. Anti-Patterns to Avoid

These are recurring failure modes. The agent checks this list before every decision:

| Anti-pattern | Correct behaviour |
|---|---|
| Acting before reading the full prompt | Always complete Phase 0 first |
| Assuming Playwright is installed | Always check; install if missing |
| Skipping progress logging | Log before AND after every step |
| Treating mistakes.md as write-only | Read it at start of task and after every failure |
| Taking one screenshot and calling it done | Screenshot every meaningful state change |
| Proceeding past ambiguity | Log it, ask the user, wait for resolution |
| Editing an earlier step silently | Note plan revisions explicitly in progress.md |
| Deleting old mistake entries | Never delete; only append |

---

## 10. Quick-Start for a New Task

```
1. mkdir -p .codex/screenshots && touch .codex/progress.md .codex/mistakes.md
2. Read .codex/mistakes.md in full
3. Read the full user prompt — do not skip a word
4. Decompose, plan, resolve ambiguities → write plan to progress.md
5. Check Playwright: `npx playwright --version` — install if missing
6. Execute plan one step at a time, logging every action
7. Screenshot the app at every key state
8. On any failure: log to mistakes.md, fix, retry, continue
9. Run the completion checklist
10. Report done with a summary of artifacts produced
```
