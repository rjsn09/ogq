import sys
import threading
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fastapi import HTTPException
from sse_stream import GenerationQueue


class QueueTests(unittest.TestCase):
    def test_fifo_and_one_running_job(self):
        queue = GenerationQueue(5)
        release, started = threading.Event(), threading.Event()
        order = []

        def task(index):
            order.append(index)
            if index == 0:
                started.set()
                self.assertTrue(release.wait(5))
            self.assertEqual(queue.snapshot()["running"], 1)

        try:
            futures = [queue.submit(task, 0)]
            self.assertTrue(started.wait(5))
            futures.extend(queue.submit(task, i) for i in range(1, 5))
            self.assertEqual(order, [0])
            self.assertEqual(queue.snapshot()["waiting"], 4)
            with self.assertRaises(HTTPException) as error:
                queue.submit(task, 99)
            self.assertEqual(error.exception.status_code, 429)
            release.set()
            for future in futures:
                future.result(timeout=5)
        finally:
            release.set()
            queue.shutdown()
        self.assertEqual(order, list(range(5)))
        self.assertEqual(queue.snapshot()["running"], 0)
        self.assertEqual(queue.snapshot()["waiting"], 0)

    def test_failure_does_not_stop_next_job(self):
        queue = GenerationQueue(2)
        try:
            def fail():
                raise ValueError("inference failed")
            first = queue.submit(fail)
            with self.assertRaises(ValueError):
                first.result(timeout=5)
            self.assertEqual(queue.submit(lambda: "next").result(timeout=5), "next")
        finally:
            queue.shutdown()
        self.assertEqual(queue.snapshot()["waiting"], 0)

    def test_cancel_releases_capacity_and_shutdown_rejects(self):
        queue = GenerationQueue(2)
        release, started = threading.Event(), threading.Event()
        def block():
            started.set()
            release.wait(5)
        try:
            queue.submit(block)
            self.assertTrue(started.wait(5))
            canceled = queue.submit(lambda: None)
            self.assertTrue(canceled.cancel())
            next_job = queue.submit(lambda: "next")
            release.set()
            self.assertEqual(next_job.result(timeout=5), "next")
        finally:
            release.set()
            queue.shutdown()
        with self.assertRaises(RuntimeError):
            queue.submit(lambda: None)
        self.assertEqual(queue.snapshot()["waiting"], 0)


if __name__ == "__main__":
    unittest.main()
