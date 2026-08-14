#!/usr/bin/env python3
"""Regression test for make_adw.py — a generated ADW must import cleanly under
`uv run` and end in `run.finish()`, matching every hand-written adws/adw_*.py
template and the cookbook's canonical skeleton (create_adw.md).

A generated chain whose tail carries a pass/fail field must pass that field
to `accepted=`. Bare `run.finish()` defaults accepted=True and would report
success on a rejected review (SKILL.md hard rule 10).

Run directly: python3 test_make_adw.py
The runtime checks invoke `uv run` for the generated ADW's dependencies.
"""

from __future__ import annotations

import importlib.util
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
MAKE_ADW = SCRIPT_DIR / "make_adw.py"
MODULES = SCRIPT_DIR.parent / "templates" / "adws" / "adw_modules"
DATA_TYPES = MODULES / "data_types.py"

_make_adw = None


def make_adw():
    global _make_adw
    if _make_adw is None:
        spec = importlib.util.spec_from_file_location("make_adw", MAKE_ADW)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        _make_adw = module
    return _make_adw


def generate(tmp_dir: Path, name: str = "regression_check",
             agents: str = "scout,builder") -> str:
    result = subprocess.run(
        [sys.executable, str(MAKE_ADW), "--name", name, "--agents", agents],
        cwd=tmp_dir,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"make_adw.py failed: {result.stderr}"
    generated = tmp_dir / "adws" / f"adw_{name}.py"
    assert generated.exists(), f"expected {generated} to be written"
    return generated.read_text()


def finish_line(source: str) -> str:
    lines = source.splitlines()
    for i, line in enumerate(lines):
        if "return run.finish" in line:
            chunk = [line.strip()]
            if not line.rstrip().endswith(")"):
                chunk.append(lines[i + 1].strip())
            return " ".join(chunk)
    raise AssertionError("generated ADW has no return run.finish(...) call")


def test_declares_rich_dependency():
    with tempfile.TemporaryDirectory() as tmp:
        source = generate(Path(tmp))
        header = source.split('"""', 1)[0]
        assert '"rich"' in header, (
            "generated PEP-723 header is missing the 'rich' dependency; "
            "adw_modules.session -> runner -> console imports rich at module top, "
            "so a generated ADW would fail at import time under uv run"
        )


def test_ends_in_run_finish_not_run_succeeded():
    with tempfile.TemporaryDirectory() as tmp:
        source = generate(Path(tmp))
        assert "run.finish()" in source, (
            "builder-tail ADW has no pass/fail field, so bare run.finish() "
            "is correct (SKILL.md hard rule 10 still requires a finish call)"
        )
        assert "accepted=" not in source
        assert "run.succeeded" not in source, "run.succeeded was removed from Run; this raises AttributeError"


def test_reviewer_tail_emits_accepted_from_approved():
    with tempfile.TemporaryDirectory() as tmp:
        source = generate(Path(tmp), name="build_review", agents="builder,reviewer")
        line = finish_line(source)
        assert "accepted=previous is not None and previous.approved" in line, line
        assert 'reason="the reviewer never approved"' in line, line
        assert "run.succeeded" not in source


def test_every_emittable_tail_type():
    """Cover every tail make_adw can emit, plus an unknown agent -> GenericOutput."""
    cases = list(make_adw().OUTPUT_TYPES.items()) + [("custom_agent", "GenericOutput")]
    for agent, output_type in cases:
        with tempfile.TemporaryDirectory() as tmp:
            source = generate(Path(tmp), name=f"tail_{agent}", agents=agent)
        expected = make_adw().finish_call(output_type)
        got = finish_line(source)
        # finish_call is the multi-line form; collapse for comparison.
        expected_flat = " ".join(part.strip() for part in expected.splitlines())
        assert got == f"return {expected_flat}", (
            f"tail {agent} -> {output_type}: expected {expected_flat!r}, got {got!r}"
        )
        assert f"output_type={output_type}" in source


def test_acceptance_covers_falsy_pass_fail_defaults():
    """If an output type has approved/passed defaulting to False, ACCEPTANCE
    must name it. Otherwise a future OUTPUT_TYPES mapping reopens the hole.
    """
    text = DATA_TYPES.read_text()
    # Class body up to the next top-level class. Keep this tight: we only
    # care about EnvelopeBase subclasses that carry a bool field defaulting
    # to False (ReviewOutput.approved, VerifyOutput.passed).
    classes = re.findall(
        r"^class (\w+)\(.*\):((?:\n(?:    .*)?)*)",
        text,
        flags=re.MULTILINE,
    )
    falsy = {}
    for name, body in classes:
        if name.endswith("Output") or name.endswith("Result"):
            for attr in ("approved", "passed"):
                if re.search(rf"{attr}: bool = False", body):
                    falsy[name] = attr
    assert "ReviewOutput" in falsy
    assert "VerifyOutput" in falsy
    for output_type, attr in falsy.items():
        spec = make_adw().ACCEPTANCE.get(output_type)
        assert spec is not None, (
            f"{output_type}.{attr} defaults to False; ACCEPTANCE must emit "
            f"accepted= or generated chains that end on this type will "
            f"report success on a failing envelope"
        )
        assert spec[0] == attr


def _prepare_runtime(tmp: Path, name: str, agents: str) -> Path:
    adws = tmp / "adws"
    adws.mkdir(exist_ok=True)
    if not (adws / "adw_modules").exists():
        shutil.copytree(MODULES, adws / "adw_modules")
    cfg_dir = adws / "adw_sssf_config"
    cfg_dir.mkdir(exist_ok=True)
    (cfg_dir / "sssf.config.yaml").write_text(
        "defaults:\n  data_dir: adws/adw_data\n"
        "observability:\n  db: adws/adw_data/sssf.db\n"
        "agents: []\n"
    )
    generate(tmp, name=name, agents=agents)
    return adws / f"adw_{name}.py"


_HARNESS = '''#!/usr/bin/env -S uv run
# /// script
# dependencies = ["pydantic", "python-dotenv", "pyyaml", "rich"]
# ///
import importlib.util
import os
import sys
from pathlib import Path

EXTRAS = __EXTRAS__
SCRIPT = Path(__SCRIPT__)
ADW_ID = __ADW_ID__
ROOT = Path(__ROOT__)
sys.path.insert(0, str((ROOT / "adws").resolve()))
from adw_modules import agents

def execute(_run, _phase, call):
    fields = getattr(call.output_type, "model_fields", {})
    kwargs = {"status": "success", "summary": "stub"}
    for key, value in EXTRAS.items():
        if key in fields:
            kwargs[key] = value
    return call.output_type(**kwargs)

agents.validate = lambda *a, **k: None
agents.execute = execute
spec = importlib.util.spec_from_file_location("generated_adw", SCRIPT)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
os.chdir(ROOT)
sys.exit(mod.main("runtime check", "adws/adw_sssf_config/sssf.config.yaml", ADW_ID))
'''


def _run_generated(tmp: Path, script: Path, adw_id: str, extras: dict) -> tuple[int, str, str]:
    """Execute a generated ADW against a stubbed envelope. extras are field
    overrides on the last call's output type (e.g. approved=False).
    """
    harness = tmp / f"run_{adw_id}.py"
    harness.write_text(
        _HARNESS
        .replace("__EXTRAS__", repr(extras))
        .replace("__SCRIPT__", repr(str(script)))
        .replace("__ADW_ID__", repr(adw_id))
        .replace("__ROOT__", repr(str(tmp)))
    )
    result = subprocess.run(
        ["uv", "run", str(harness)],
        cwd=tmp,
        capture_output=True,
        text=True,
    )
    status = ""
    db = tmp / "adws" / "adw_data" / "sssf.db"
    if db.exists():
        row = sqlite3.connect(db).execute(
            "SELECT status FROM sessions WHERE adw_id=?", (adw_id,)
        ).fetchone()
        status = row[0] if row else ""
    return result.returncode, result.stdout + result.stderr, status


def test_reviewer_tail_fails_when_not_approved():
    """The defect: generated reviewer ADW + approved=False used to exit 0
    with a green success banner and a success session row.
    """
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        script = _prepare_runtime(root, "repro_review", "builder,reviewer")
        code, output, status = _run_generated(
            root, script, "repro0001", {"approved": False}
        )
        assert code == 1, f"expected exit 1, got {code}\n{output}"
        assert status == "fail", f"expected session fail, got {status!r}\n{output}"
        assert "not accepted" in output
        assert "the reviewer never approved" in output
        assert "✗ fail" in output or "session repro0001 fail" in output


def test_reviewer_tail_succeeds_when_approved():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        script = _prepare_runtime(root, "repro_review_ok", "builder,reviewer")
        code, output, status = _run_generated(
            root, script, "repro0002", {"approved": True}
        )
        assert code == 0, f"expected exit 0, got {code}\n{output}"
        assert status == "success", f"expected session success, got {status!r}\n{output}"
        assert "not accepted" not in output


def test_builder_tail_still_succeeds_without_accepted():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        script = _prepare_runtime(root, "repro_build", "builder")
        code, output, status = _run_generated(root, script, "repro0003", {})
        assert code == 0, f"expected exit 0, got {code}\n{output}"
        assert status == "success", f"expected session success, got {status!r}\n{output}"


if __name__ == "__main__":
    tests = [
        test_declares_rich_dependency,
        test_ends_in_run_finish_not_run_succeeded,
        test_reviewer_tail_emits_accepted_from_approved,
        test_every_emittable_tail_type,
        test_acceptance_covers_falsy_pass_fail_defaults,
        test_reviewer_tail_fails_when_not_approved,
        test_reviewer_tail_succeeds_when_approved,
        test_builder_tail_still_succeeds_without_accepted,
    ]
    failures = 0
    for test in tests:
        try:
            test()
            print(f"PASS {test.__name__}")
        except AssertionError as error:
            failures += 1
            print(f"FAIL {test.__name__}: {error}")
        except Exception as error:
            failures += 1
            print(f"ERROR {test.__name__}: {type(error).__name__}: {error}")
    sys.exit(1 if failures else 0)
