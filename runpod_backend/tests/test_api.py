"""Real HTTP routes/SSE with mocked inference; no model download or GPU needed."""
import ast
import importlib
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # API tests need neither a Linux /workspace nor model cache directories.
        with patch("runtime.configure_runtime"):
            cls.server = importlib.import_module("Server")
        cls.service = cls.server.canonical_api_service
        # Intentionally no TestClient context: skip CUDA startup only.
        cls.client = TestClient(cls.server.app)
        cls.server.generator = type("FakeGenerator", (), {"device": "test"})()

    @classmethod
    def tearDownClass(cls):
        cls.server.generation_queue.shutdown()
        cls.client.close()

    def test_original_routes_are_preserved(self):
        original = ROOT.parent / "backend"
        if not original.exists():
            self.skipTest("Original backend not included in standalone deployment")
        def routes(path):
            result = set()
            for node in ast.walk(ast.parse(path.read_text(encoding="utf-8"))):
                if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    for decorator in node.decorator_list:
                        if isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Attribute):
                            if decorator.func.attr in {"get", "post"}:
                                result.add((decorator.func.attr, ast.literal_eval(decorator.args[0])))
            return result
        for name in ("Server.py", "canonical_api.py"):
            self.assertEqual(routes(original / name), routes(ROOT / name))

    def test_all_generation_routes_and_replay(self):
        service = self.service
        def canonical(**kwargs):
            with service.canonicals_lock:
                service.canonicals[kwargs["canonical_id"]].update(
                    status="ready", canonical_image="data:image/png;base64,TEST")
        def stickers(**kwargs):
            with service.jobs_lock:
                service.jobs[kwargs["job_id"]].update(status="done", images=[{"index": 1, "image": "TEST"}])
        with patch.object(service, "_run_canonical_job", side_effect=canonical), patch.object(service, "_run_sticker_job", side_effect=stickers):
            response = self.client.post("/api/canonical", data={"character_base": "cat"})
            self.assertEqual(response.status_code, 200, response.text)
            self.assertIn("event: done", response.text)
            import json
            identity = json.loads(next(line[6:] for line in response.text.splitlines() if line.startswith("data: ")))
            cid = identity["canonical_id"]
            self.assertEqual(self.client.get(f"/api/canonical/{cid}").json()["status"], "ready")
            regenerated = self.client.post(f"/api/canonical/{cid}/regenerate", data={"edit_request": "smile"})
            self.assertIn("event: done", regenerated.text)
            self.assertEqual(self.client.post(f"/api/canonical/{cid}/approve").status_code, 200)
            generated = self.client.post(f"/api/canonical/{cid}/generate-set", data={"indices": "[1]"})
            self.assertIn("event: done", generated.text)
            direct = self.client.post("/api/generate-set", data={"character_base": "cat", "indices": "[1]"})
            self.assertIn("event: done", direct.text)
            identity = json.loads(next(line[6:] for line in direct.text.splitlines() if line.startswith("data: ")))
            jid = identity["job_id"]
            replay = self.client.get(f"/api/generate-set/{jid}/events")
            self.assertIn("event: image", replay.text)
            self.assertIn("event: done", replay.text)
            self.assertEqual(self.client.get(f"/api/generate-set/{jid}/events", headers={"Last-Event-ID": "2"}).status_code, 204)
            self.assertEqual(self.client.get(f"/api/generate-set/{jid}").json()["status"], "done")

    def test_health_exposes_single_worker(self):
        health = self.client.get("/api/health")
        self.assertEqual(health.status_code, 200)
        self.assertEqual(health.json()["queue"]["workers"], 1)


if __name__ == "__main__":
    unittest.main()
