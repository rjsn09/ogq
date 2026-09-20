"""Offline regression tests shared by both deployment copies."""
import contextlib
import importlib
import io
import os
import sys
import types
import unittest
from unittest.mock import patch


class RateLimitError(Exception):
    pass


class PlannerKeyTests(unittest.TestCase):
    def run_case(self, module_name, outcomes, fallback="secondary"):
        calls = []

        class Client:
            def __init__(self, *, api_key, **options):
                self.key = api_key
                self.options = options
                self.chat = types.SimpleNamespace(completions=self)

            def with_options(self, *, api_key):
                return Client(api_key=api_key, **self.options)

            def create(self, **kwargs):
                calls.append((self.key, kwargs, self.options))
                result = outcomes.pop(0)
                if isinstance(result, Exception):
                    raise result
                return types.SimpleNamespace(
                    choices=[types.SimpleNamespace(
                        message=types.SimpleNamespace(content=result))],
                    headers={"x-ratelimit-remaining-tokens": "0"},
                )

        sdk = types.SimpleNamespace(OpenAI=Client, RateLimitError=RateLimitError)
        env = {
            "PROMPT_PLANNER_MODE": "llm", "PROMPT_LLM_MODEL": "test-model",
            "LLM_BASE_URL": "https://api.groq.com/openai/v1",
            "GROQ_API_KEY": "primary", "GROQ_API_KEY_FB": fallback,
        }
        with patch.dict(sys.modules, openai=sdk), patch.dict(os.environ, env):
            with contextlib.redirect_stdout(io.StringIO()):
                planner = importlib.import_module(module_name).PromptPlanner()
            try:
                result = planner._json_call("system", "user")
            except Exception as exc:
                result = exc
        return result, calls, planner

    def test_key_rotation_and_failure_bounds(self):
        for module in ("backend.canonical_dreamo", "runpod_backend.canonical_dreamo"):
            cases = [
                ([RateLimitError(), '{"prompt":"ok"}'], "secondary", ["primary", "secondary"], dict),
                ([RateLimitError(), RateLimitError()], "secondary", ["primary", "secondary"], RateLimitError),
                ([RateLimitError()], "", ["primary"], RateLimitError),
                ([RateLimitError()], "primary", ["primary"], RateLimitError),
                (['{"prompt":"ok"}'], "secondary", ["primary"], dict),
                ([ValueError("other failure")], "secondary", ["primary"], ValueError),
                ([RateLimitError(), '[]', '{"prompt":"ok"}'], "secondary", ["primary", "secondary", "secondary"], dict),
                ([RateLimitError(), '[]', RateLimitError()], "secondary", ["primary", "secondary", "secondary"], RateLimitError),
                (['[]', '[]'], "secondary", ["primary", "primary"], ValueError),
            ]
            for outcomes, fallback, expected_keys, expected_type in cases:
                with self.subTest(module=module, keys=expected_keys, result=expected_type):
                    final_outcome = outcomes[-1]
                    result, calls, planner = self.run_case(module, outcomes, fallback)
                    self.assertIsInstance(result, expected_type)
                    self.assertEqual([call[0] for call in calls], expected_keys)
                    self.assertTrue(all(call[2]["max_retries"] == 0 for call in calls))
                    self.assertEqual(planner.api_key, expected_keys[-1])
                    if isinstance(final_outcome, RateLimitError):
                        self.assertIs(result, final_outcome)
                    if len(calls) == 3:
                        self.assertIn("Return exactly ONE", calls[-1][1]["messages"][-1]["content"])


if __name__ == "__main__":
    unittest.main()
