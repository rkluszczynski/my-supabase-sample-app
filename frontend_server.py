from __future__ import annotations

import os
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


ROOT = Path("/app/frontend/dist")
PORT = int(os.environ.get("PORT", "4173"))


def runtime_config_script() -> bytes:
    supabase_url = os.environ.get("VITE_SUPABASE_URL", "")
    publishable_key = os.environ.get("VITE_SUPABASE_PUBLISHABLE_KEY", "")
    script = f"""window.__S2APP_CONFIG__ = {{
  supabaseUrl: {supabase_url!r},
  supabasePublishableKey: {publishable_key!r}
}};"""
    return script.encode("utf-8")


class SpaHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self) -> None:  # noqa: N802
        requested = self.path.split("?", 1)[0]

        if requested == "/runtime-config.js":
            payload = runtime_config_script()
            self.send_response(200)
            self.send_header("Content-Type", "application/javascript; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(payload)
            return

        if requested in ("/", "/index.html"):
            index_path = ROOT / "index.html"
            html = index_path.read_text(encoding="utf-8")
            injection = '<script src="/runtime-config.js"></script>'
            html = html.replace("</body>", f"  {injection}\n  </body>")
            payload = html.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(payload)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(payload)
            return

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
