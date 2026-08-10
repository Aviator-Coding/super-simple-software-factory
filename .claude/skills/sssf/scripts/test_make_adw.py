#!/usr/bin/env python3
"""Regression test for make_adw.py — a generated ADW must import cleanly under
`uv run` and end in `run.finish()`, matching every hand-written adws/adw_*.py
template and the cookbook's canonical skeleton (create_adw.md).

Run directly: python3 test_make_adw.py
"""

import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
MAKE_ADW = SCRIPT_DIR / "make_adw.py"


def generate(tmp_dir: Path) -> str:
    result = subprocess.run(
        [sys.executable, str(MAKE_ADW), "--name", "regression_check", "--agents", "scout,builder"],
        cwd=tmp_dir,
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, f"make_adw.py failed: {result.stderr}"
    generated = tmp_dir / "adws" / "adw_regression_check.py"
    assert generated.exists(), f"expected {generated} to be written"
    return generated.read_text()


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
        assert "run.finish()" in source, "generated ADW must end in run.finish() (SKILL.md hard rule 10)"
        assert "run.succeeded" not in source, "run.succeeded was removed from Run; this raises AttributeError"


if __name__ == "__main__":
    tests = [test_declares_rich_dependency, test_ends_in_run_finish_not_run_succeeded]
    failures = 0
    for test in tests:
        try:
            test()
            print(f"PASS {test.__name__}")
        except AssertionError as error:
            failures += 1
            print(f"FAIL {test.__name__}: {error}")
    sys.exit(1 if failures else 0)
