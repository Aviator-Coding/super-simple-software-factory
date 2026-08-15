#!/usr/bin/env python3
"""This repo must publish a real GitHub Actions check on push and PR.

Verified 2026-08-15 against the live GitHub API for
Aviator-Coding/super-simple-software-factory, the same operator path that
found the gap on 2026-08-14 while merging PR #2:

- ``gh-axi pr checks 2`` -> ``0 passed, 0 failed - this PR has no CI checks configured``
- ``gh-axi pr checks 3`` -> same
- ``GET /repos/.../actions/workflows`` -> ``total_count: 0``
- ``GET /repos/.../commits/c00cebd/check-runs`` (PR #2 head) -> ``total_count: 0``
- ``GET /repos/.../commits/c00cebd/status`` -> ``statuses: []``, ``state: pending``

Without a workflow, mergeStateStatus can be CLEAN because nothing is required,
so a no-mistakes "checks green" report is only the pipeline's local gates.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
WORKFLOWS = REPO / ".github" / "workflows"
SCRIPTS = ".claude/skills/sssf/scripts"


def _strip_comments(text: str) -> str:
    lines = []
    for line in text.splitlines():
        if "#" in line:
            line = line.split("#", 1)[0]
        lines.append(line.rstrip())
    return "\n".join(lines)


def _workflow_files() -> list[Path]:
    if not WORKFLOWS.is_dir():
        return []
    return sorted(WORKFLOWS.glob("*.yml")) + sorted(WORKFLOWS.glob("*.yaml"))


def _on_triggers(text: str) -> set[str]:
    blob = _strip_comments(text)
    found: set[str] = set()
    flow = re.search(r"^on:\s*\[([^\]]+)\]", blob, re.M)
    if flow:
        for part in flow.group(1).split(","):
            key = part.strip().strip("'\"")
            if key:
                found.add(key)
        return found
    block = re.search(r"^on:\s*$", blob, re.M)
    if not block:
        return found
    for line in blob[block.end() :].splitlines():
        if not line.strip():
            continue
        if line[:1] in {" ", "\t"}:
            key = line.strip().rstrip(":").strip("'\"")
            if key:
                found.add(key)
            continue
        break
    return found


_BLOCK_SCALAR_INDICATORS = {"|", ">", "|-", ">-", "|+", ">+"}


def _run_step_commands(text: str) -> list[str]:
    """Extract the literal command text of each step's ``run:`` key.

    This walks the block structure (indentation) rather than treating the
    file as one blob, so a ``pytest`` mention in an unrelated step or a
    scripts-path mention in an unrelated key (e.g. a ``paths:`` trigger
    filter) cannot be mistaken for a step that actually runs pytest.
    """
    blob = _strip_comments(text)
    lines = blob.splitlines()
    commands: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i]
        match = re.match(r"^(?P<indent>[ \t]*)-?\s*run:[ \t]*(?P<val>.*)$", line)
        if not match:
            i += 1
            continue
        indent = len(match.group("indent"))
        val = match.group("val").strip()
        i += 1
        if val and val not in _BLOCK_SCALAR_INDICATORS:
            commands.append(val)
            continue
        block_lines = []
        while i < len(lines):
            next_line = lines[i]
            if not next_line.strip():
                block_lines.append(next_line)
                i += 1
                continue
            next_indent = len(next_line) - len(next_line.lstrip(" \t"))
            if next_indent <= indent:
                break
            block_lines.append(next_line)
            i += 1
        commands.append("\n".join(block_lines))
    return commands


def _runs_scripts_pytest(text: str) -> bool:
    return any(
        "pytest" in command and SCRIPTS in command
        for command in _run_step_commands(text)
    )


def test_push_pr_workflow_runs_script_pytest():
    files = _workflow_files()
    assert files, (
        f"no GitHub Actions workflow under {WORKFLOWS}; "
        "gh-axi pr checks reports no CI on this repo"
    )
    matching = []
    for path in files:
        text = path.read_text()
        triggers = _on_triggers(text)
        if (
            "push" in triggers
            and "pull_request" in triggers
            and _runs_scripts_pytest(text)
        ):
            matching.append(path)
    assert matching, (
        f"no workflow in {WORKFLOWS} triggers on both push and pull_request "
        f"and runs pytest on {SCRIPTS}/"
    )


if __name__ == "__main__":
    try:
        test_push_pr_workflow_runs_script_pytest()
    except AssertionError as error:
        print(f"FAIL test_push_pr_workflow_runs_script_pytest: {error}")
        sys.exit(1)
    print("PASS test_push_pr_workflow_runs_script_pytest")
    sys.exit(0)
