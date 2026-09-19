import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from runtime import single_server


@unittest.skipUnless(sys.platform == "linux", "RunPod process locking requires Linux")
class RuntimeTests(unittest.TestCase):
    def test_second_process_rejected_and_lock_released(self):
        with tempfile.TemporaryDirectory() as folder:
            with patch.dict(os.environ, {"RUNPOD_LOCK_FILE": str(Path(folder) / "server.lock")}):
                script = "from runtime import single_server\nwith single_server(): print('acquired')"
                with single_server():
                    blocked = subprocess.run([sys.executable, "-c", script], cwd=ROOT, capture_output=True, text=True, timeout=10)
                    self.assertNotEqual(blocked.returncode, 0)
                    self.assertIn("Another backend is already running", blocked.stderr)
                allowed = subprocess.run([sys.executable, "-c", script], cwd=ROOT, capture_output=True, text=True, timeout=10)
                self.assertEqual(allowed.returncode, 0, allowed.stderr)


if __name__ == "__main__":
    unittest.main()
