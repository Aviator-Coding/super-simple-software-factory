---
description: Prime context for Super Simple Software Factory (SSSF) — the ADW factory skill, its agent roster, and how to run and observe workflows.
---

# Purpose

Orient yourself in Super Simple Software Factory (SSSF): a deployable skill that stamps any repo with **agents plus code** workflows, where deterministic Python ADW scripts own sequencing, retries, and acceptance while coding agents work as bounded phases inside them. Agent proposes, code disposes.

## Workflow

1. Map the repo: `git ls-files | head -60`, then `ls adws/ adws/adw_modules/ .claude/skills/sssf/cookbooks/`. The runnable workflows are `adws/adw_*.py` (twelve of them); every one opens with a `Phases:` docstring line that is its chain in one line, so `head -20 adws/adw_<name>.py` tells you what it does. All low-level logic lives in `adws/adw_modules/`, because ADW scripts stay thin.

2. Read `README.md` for the doctrine and the folder map, then `.claude/skills/sssf/SKILL.md` for the hard rules and the request-routing table. The skill directory is the product; everything outside it is stamped output.

3. Read `.claude/skills/sssf/cookbooks/sssf_overview.md`, the system map. The other eight cookbooks and the three `references/` specs load lazily, one per request. Note the synced output-contract triad: the type in `adw_modules/data_types.py`, the `## Report` JSON example in the agent's `user.md`, and `output_type=` at the call site all change together.

4. Read `adws/adw_sssf_config/sssf.config.yaml`, the agent roster: `planner`, `builder`, `scout`, `reviewer`, `documenter`. There is no tester, because running a suite is a known command and therefore a `kind="code"` phase over `adw_modules/quality.py`. Models are written `provider/model-id` (a bare pattern is ambiguous and fails validation). Prompts are edited at `adws/adw_data/prompt_engineering/{agent}/{system.md,user.md}`, never in the skill's `templates/`. `just rosters` prints every roster with the model each agent runs.

5. Read `justfile` and `adws/adw_prompt.py`, the smallest ADW, to see how a run is invoked and how the phase API reads. ADWs run as `uv run adws/adw_*.py "<prompt or path/to/prompt.md>" [--adw-id X] [--config Y]`, or through the justfile recipes. `--adw-id` is optional everywhere: pass one to join an existing session and resume agent context, omit it to mint a fresh id.

6. Note how to observe before you need it: the WAL SQLite trace db at `adws/adw_data/sssf.db` holds `sessions`, `phases`, `events`, `envelopes`, `gate_results`, `agent_sessions`, and `processes` (adw_id to pid, so a stuck run can be stopped). Reads never block a running ADW. `just sessions`, `just phases <adw_id>`, `just tail <adw_id>`, and `just procs <adw_id>` are the quick reads; `references/observability.md` is the schema. **Never edit anything inside `adws/adw_data/sessions/`**, which is the run record.

7. Summarize your understanding of the project: purpose, stack, structure, key files, and entry points. Then stop and wait for a request, rather than surveying further.
