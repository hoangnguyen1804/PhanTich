"""Compatibility entry point for the complete 1.1 offline browser acceptance workflow."""
from pathlib import Path
import runpy
runpy.run_path(str(Path(__file__).with_name("browser-upgrade.py")),run_name="__main__")
