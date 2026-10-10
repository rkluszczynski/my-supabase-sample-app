from __future__ import annotations

import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path("/app/frontend/dist")
PORT = int(os.environ.get("PORT", "4173"))


class SpaHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self) -> None:  # noqa: N802
        requested = self.path.split("?", 1)[0]
        candidate = (ROOT / requested.lstrip("/")).resolve()

        if requested != "/" and candidate.exists() and candidate.is_file() and ROOT in candidate.parents:
            return super().do_GET()

        self.path = "/index.html"
        return super().do_GET()


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), SpaHandler)
    print(f"Frontend listening on http://0.0.0.0:{PORT}")
    print("Cron schedule: 17 4,10,16,22 * * * (CET)")
    server.serve_forever()
