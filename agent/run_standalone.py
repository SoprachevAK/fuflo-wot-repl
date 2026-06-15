"""Run the agent standalone, simulating the game's embedded py2.7 (no BigWorld).

    python run_standalone.py <buffer_dir>

Used by the Rust transport integration test and for manual loopback testing
without launching the client.
"""

import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import wms_agent

wms_agent.start(sys.argv[1] if len(sys.argv) > 1 else '.')

try:
    while True:
        time.sleep(0.2)
except KeyboardInterrupt:
    pass
