#!/usr/bin/env python3
"""
Темная Башня - Локальный веб-сервер для интерактивного листа персонажа.
Запускает локальный сервер и автоматически открывает браузер.
"""

import http.server
import socketserver
import webbrowser
import os
import sys

if sys.platform == 'win32':
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

PORT = 8080
DIRECTORY = os.path.dirname(os.path.abspath(__file__))

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def do_GET(self):
        # Перенаправление с корня на /index.html
        if self.path in ('/', ''):
            self.send_response(302)
            self.send_header('Location', '/index.html')
            self.end_headers()
            return

        # Специальная обработка для favicon.ico
        if self.path == '/favicon.ico':
            ico_path = os.path.join(DIRECTORY, 'favicon.ico')
            if os.path.isfile(ico_path):
                self.send_response(200)
                self.send_header('Content-Type', 'image/x-icon')
                with open(ico_path, 'rb') as f:
                    content = f.read()
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
            else:
                self.send_response(204)  # No content, не 404
                self.end_headers()
                return

        super().do_GET()

    def log_message(self, format, *args):
        # Не спамим консоль ошибками favicon
        msg = args[0]
        if "favicon.ico" in msg and "404" in msg:
            return
        sys.stderr.write(f"[{self.log_date_time_string()}] {msg}\n")

def main():
    os.chdir(DIRECTORY)
    
    # Поиск свободного порта, если 8080 занят
    global PORT
    while True:
        try:
            with socketserver.TCPServer(("", PORT), Handler) as httpd:
                url = f"http://localhost:{PORT}/index.html"
                print("=" * 60)
                print("   ТЕМНАЯ БАШНЯ — ИНТЕРАКТИВНЫЙ БЛАНК ПЕРСОНАЖА")
                print("=" * 60)
                print(f"Сервер успешно запущен по адресу: {url}")
                print("Для выхода нажмите Ctrl+C в этом окне.")
                print("=" * 60)
                
                # Открываем браузер
                try:
                    webbrowser.open(url)
                except Exception as e:
                    print(f"Не удалось открыть браузер автоматически: {e}")
                
                httpd.serve_forever()
                break
        except OSError as e:
            if e.errno == 10048 or "Address already in use" in str(e):
                PORT += 1
            else:
                raise e

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nСервер остановлен.")
        sys.exit(0)
