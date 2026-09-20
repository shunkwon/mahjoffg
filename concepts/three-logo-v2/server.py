"""Local render preview and a bounded PNG export sink."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import urlsplit
import json
import struct

ROOT = Path(__file__).resolve().parent
OUTPUT = ROOT / "exports"
ALLOWED = {f"mahjoffg-{palette}-{layout}-v2.png" for palette in ("sky", "opal") for layout in ("tile", "mark")}


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_POST(self):
        name = urlsplit(self.path).path.removeprefix("/export/")
        if not self.path.startswith("/export/") or name not in ALLOWED:
            self.send_error(404)
            return
        origin = self.headers.get("Origin", "")
        if origin != "http://127.0.0.1:8791":
            self.send_error(403)
            return
        try:
            size = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self.send_error(400)
            return
        if not 24 <= size <= 20_000_000:
            self.send_error(413)
            return
        data = self.rfile.read(size)
        if data[:8] != b"\x89PNG\r\n\x1a\n" or struct.unpack(">II", data[16:24]) != (2048, 2048):
            self.send_error(400, "Expected a 2048 x 2048 PNG")
            return
        OUTPUT.mkdir(exist_ok=True)
        (OUTPUT / name).write_bytes(data)
        body = json.dumps({"saved": str(OUTPUT / name)}, ensure_ascii=False).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 8791), Handler).serve_forever()
