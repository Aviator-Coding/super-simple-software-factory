set dotenv-load
set positional-arguments

# Recipes run through an INTERACTIVE zsh so the engineer's own profile is live.
# just's default is a bare non-interactive `sh`, which never sources ~/.zshrc —
# so any harness installed as a shell function rather than a binary on PATH
# (`ipi`) failed with "command not found", while real binaries (`pi`, `claude`)
# happened to work. Same principle as adw_modules/utils.operator_env: what runs
# here should see exactly what the engineer sees.
#
# Two things to know: `.env` still wins over the profile (dotenv-load is applied
# to the recipe's environment), and a recipe with its own `#!` shebang bypasses
# this setting entirely — `kill` below runs as a bash script and only calls real
# binaries, which is why that is fine.
set shell := ["zsh", "-ic"]

# Silences macOS's "Saving session..." on every interactive shell exit.
export SHELL_SESSIONS_DISABLE := "1"

# default config every run uses — override: SSSF_CONFIG=other.yaml just sdlc "..."  (or pass --config in args)
config := env_var_or_default("SSSF_CONFIG", "adws/adw_sssf_config/sssf.config.yaml")

# list commands
default:
    @just --list

# ── orchestrator agents (boot an agent ON the factory) ─────────────────────

# Claude Code orchestrator — reads the sssf overview, then handles your ask
cc:
    claude --dangerously-skip-permissions "Read and Execute .claude/skills/sssf/SKILL.md"

# Pi orchestrator — same posture, pi harness
pi:
    pi "Read and Execute .claude/skills/sssf/SKILL.md"

# ipi orchestrator — same posture, ipi harness
ipi:
    ipi "Read and Execute .claude/skills/sssf/SKILL.md" --no-skills

# ── raw ADW runs (args pass straight through: "prompt" [--adw-id X] [--config Y]) ──

# one agent, one prompt (add --agent NAME to pick; default builder)
prompt *ARGS:
    uv run adws/adw_prompt.py --config {{config}} "$@"

# pick the agent by name: just ask scout "where does auth live"
ask AGENT *ARGS:
    uv run adws/adw_prompt.py --config {{config}} --agent {{AGENT}} "${@:2}"

# read-only recon
scout *ARGS:
    uv run adws/adw_scout.py --config {{config}} "$@"

# plan only
plan *ARGS:
    uv run adws/adw_plan.py --config {{config}} "$@"

# planner → builder
plan-build *ARGS:
    uv run adws/adw_plan_build.py --config {{config}} "$@"

# builder → deterministic test with bounded fix loop
build-test *ARGS:
    uv run adws/adw_build_test.py --config {{config}} "$@"

# builder → reviewer with bounded revise loop (is it what was asked for?)
build-review *ARGS:
    uv run adws/adw_build_review.py --config {{config}} "$@"

# write up the work just done, from git diff vs main (add --base REF to change it)
document *ARGS:
    uv run adws/adw_document.py --config {{config}} "$@"

# the full chain: plan → build → deterministic test/fix
sdlc *ARGS:
    uv run adws/adw_plan_build_test.py --config {{config}} "$@"

# plan → build → test → review → document, committing the plan, the code, and the docs separately
simple-sdlc *ARGS:
    uv run adws/adw_simple_sdlc.py --config {{config}} "$@"

# ── observability ──────────────────────────────────────────────────────────

# which rosters exist and who is in them: just rosters
# The roster is chosen per run — `--config <path>` on any ADW, or SSSF_CONFIG
# for these recipes. This is how you find the path to pass.
rosters:
    #!/usr/bin/env bash
    for f in adws/adw_sssf_config/*.yaml; do
      printf '%s\n' "$f"
      awk '
        /^agents:/ { in_agents = 1 }
        /^  model:/ && !in_agents { default_model = $2 }
        /^  - name:/ {
          if (name) printf "    %-11s %s\n", name, (model ? model : default_model " (inherited)")
          name = $3; model = ""
        }
        /^    model:/ { model = $2 }
        END { if (name) printf "    %-11s %s\n", name, (model ? model : default_model " (inherited)") }
      ' "$f"
    done

# recent sessions
sessions:
    sqlite3 adws/adw_data/sssf.db "select adw_id, status, substr(request,1,60), total_tokens, round(total_cost,4) from sessions order by started_at desc limit 10;"

# phases for one adw: just phases <adw_id>
phases ADW_ID:
    sqlite3 adws/adw_data/sssf.db "select seq, name, kind, owner, status, attempt from phases where adw_id='{{ADW_ID}}' order by seq;"

# live event tail for one adw: just tail <adw_id>
tail ADW_ID:
    sqlite3 adws/adw_data/sssf.db "select rowid, type, name, started_at from events where adw_id='{{ADW_ID}}' order by rowid desc limit 25;"

# what a run is running right now: just procs <adw_id>
procs ADW_ID:
    sqlite3 adws/adw_data/sssf.db "select kind, name, pid, command, started_at from processes where adw_id='{{ADW_ID}}' and ended_at is null order by id;"

# stop a stuck run — children first, then the workflow: just kill <adw_id>
# Verifies each pid still looks like the thing we recorded; pids get recycled.
kill ADW_ID:
    #!/usr/bin/env bash
    set -uo pipefail
    rows=$(sqlite3 adws/adw_data/sssf.db "select kind||' '||pid from processes where adw_id='{{ADW_ID}}' and ended_at is null order by case kind when 'agent' then 0 else 1 end, id desc;")
    [ -z "$rows" ] && { echo "no live processes recorded for {{ADW_ID}}"; exit 0; }
    while read -r kind pid; do
        [ -z "${pid:-}" ] && continue
        cmd=$(ps -p "$pid" -o command= 2>/dev/null || true)
        if [ -z "$cmd" ]; then echo "  · $kind $pid already gone"; continue; fi
        case "$cmd" in
            *pi*|*adw_*|*python*) kill "$pid" && echo "  ✗ killed $kind $pid — $cmd" ;;
            *) echo "  ! $kind $pid is now '$cmd' — pid reused, NOT killing" ;;
        esac
    done <<< "$rows"

# boot the observability UI (server :4600 + vite dev)
# The db path resolves against the server's cwd, and the server runs from the
# app dir — so it is passed explicitly rather than left to be discovered.
obs:
    cd .claude/skills/sssf/apps/visualizer && bun install && (SSSF_DB={{justfile_directory()}}/adws/adw_data/sssf.db bun run server/index.ts &) && bunx vite
