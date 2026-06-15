"""Integration test: drive the real agent loop like the desktop would.

Exercises the daemon poll thread, main-thread dispatch (inline without BigWorld),
stdout capture, and namespace persistence across requests. Runs on py2.7 or 3.x.
"""

import os
import sys
import time
import shutil
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from wms_agent.framebus import FrameBus
import wms_agent


def main():
    work = tempfile.mkdtemp(prefix="wms_itest_")
    desktop = FrameBus(work, out_name="d2c", in_name="c2d")
    try:
        wms_agent.start(work, interval=0.02)

        desktop.send({"id": "1", "type": "exec", "code": "print('hello'); x = 40 + 2"})
        desktop.send({"id": "2", "type": "exec", "code": "x * 2"})

        results = {}
        stdout_text = ""
        deadline = time.time() + 3.0
        while time.time() < deadline and not ("2" in results and "hello" in stdout_text):
            for frame in desktop.drain():
                if frame.get("type") == "stdout":
                    stdout_text += frame.get("text", "")
                elif frame.get("id"):
                    results[frame["id"]] = frame
            time.sleep(0.02)

        wms_agent.stop()  # restores stdout before we assert/print

        assert results.get("2", {}).get("repr") == "84", results
        assert "hello" in stdout_text, repr(stdout_text)

        print("ITEST OK  ns-persist x*2=%s  captured=%r"
              % (results["2"]["repr"], stdout_text.strip()))
        return 0
    finally:
        try:
            wms_agent.stop()
        except Exception:
            pass
        shutil.rmtree(work, ignore_errors=True)


if __name__ == "__main__":
    sys.exit(main())
