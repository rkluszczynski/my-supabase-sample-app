FROM node:22-alpine AS frontend-build
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


FROM python:3.11-alpine AS backend-build
WORKDIR /app/backend

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY backend/pyproject.toml ./
COPY backend/src ./src
RUN pip install --no-cache-dir --prefix=/install .


FROM python:3.11-alpine AS runtime
WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PATH="/usr/local/bin:${PATH}"

COPY --from=backend-build /install /usr/local
COPY --from=frontend-build /app/frontend/dist ./frontend/dist
COPY --from=frontend-build /usr/local/bin/node /usr/local/bin/node
COPY --from=frontend-build /usr/local/lib/node_modules /usr/local/lib/node_modules
COPY --from=backend-build /app/backend ./backend

EXPOSE 4173

CMD ["node", "-e", "const { createServer } = require('node:http'); const { readFileSync, createReadStream, statSync, existsSync } = require('node:fs'); const { extname, join, normalize } = require('node:path'); const root = '/app/frontend/dist'; const port = Number(process.env.PORT || 4173); const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.woff': 'font/woff', '.woff2': 'font/woff2' }; createServer((req, res) => { const urlPath = (req.url || '/').split('?')[0]; const safePath = normalize(urlPath).replace(/^\\/+/, ''); let filePath = join(root, safePath); if (urlPath === '/' || !existsSync(filePath) || statSync(filePath, { throwIfNoEntry: false })?.isDirectory()) { filePath = join(root, 'index.html'); } const ext = extname(filePath); res.setHeader('Content-Type', mime[ext] || 'application/octet-stream'); createReadStream(filePath).on('error', () => { res.statusCode = 404; res.end('Not found'); }).pipe(res); }).listen(port, '0.0.0.0', () => { console.log(`Frontend listening on http://0.0.0.0:${port}`); });"]
