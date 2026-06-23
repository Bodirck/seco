#!/usr/bin/env python
"""Run the BuildingLens app: FastAPI backend + React (Vite) dev server together.

This is the primary way to run the polished UI. Use `make web` or:

    python scripts/dev.py

It starts both processes and streams their output to this terminal:
  - FastAPI on http://127.0.0.1:8000   (python -m uvicorn api.main:app)
  - React   on http://localhost:5173   (npm run dev in web/, proxies /api to :8000)

Open http://localhost:5173 in the browser. The Streamlit app (`make run`) stays
available as a lightweight backup UI. Press Ctrl+C to stop both servers.

Prerequisites: `make install`, `make data`, `make extract`, and `npm install` in web/.
"""

from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
IS_WIN = sys.platform == "win32"


def _spawn(cmd: list[str], cwd: Path) -> subprocess.Popen:
    kwargs: dict = {"cwd": str(cwd)}
    if IS_WIN:
        # Own process group so Ctrl+C handling and the taskkill tree work cleanly.
        kwargs["creationflags"] = subprocess.CREATE_NEW_PROCESS_GROUP
    return subprocess.Popen(cmd, **kwargs)


def _kill(proc: subprocess.Popen) -> None:
    if proc.poll() is not None:
        return
    if IS_WIN:
        # npm spawns node/esbuild children; kill the whole tree.
        subprocess.run(
            ["taskkill", "/F", "/T", "/PID", str(proc.pid)],
            capture_output=True,
        )
    else:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()


def main() -> int:
    npm = "npm.cmd" if IS_WIN else "npm"
    if not (WEB / "node_modules").exists():
        print(
            "[dev] web/node_modules is missing. Run `npm install` in web/ first.",
            file=sys.stderr,
        )

    procs: list[subprocess.Popen] = []
    try:
        procs.append(
            _spawn(
                [sys.executable, "-m", "uvicorn", "api.main:app", "--port", "8000", "--host", "127.0.0.1"],
                ROOT,
            )
        )
        procs.append(_spawn([npm, "run", "dev"], WEB))
        print(
            "[dev] FastAPI http://127.0.0.1:8000  |  React http://localhost:5173  (Ctrl+C to stop both)"
        )
        # Run until either server exits, then bring the other down too.
        while True:
            for proc in procs:
                if proc.poll() is not None:
                    print(f"[dev] a server exited (code {proc.returncode}); shutting down the other.")
                    return proc.returncode or 1
            time.sleep(0.5)
    except KeyboardInterrupt:
        print("\n[dev] stopping both servers...")
        return 0
    finally:
        for proc in procs:
            _kill(proc)


if __name__ == "__main__":
    raise SystemExit(main())
