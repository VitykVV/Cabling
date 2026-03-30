import fs from 'node:fs';
import path from 'node:path';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import type { AppStatePayload, DocumentExportPayload, SavedConfiguration } from '../src/shared/types.ts';
import { createPdfBytes, createXlsxBuffer } from './export.ts';
import { deleteConfiguration, getBootstrapPayload, saveState, upsertConfiguration } from './store.ts';
import { stripBom } from '../src/shared/utils.ts';

const port = Number(process.env.PORT ?? 4321);
const host = process.env.HOST ?? '0.0.0.0';
const distDir = path.resolve(process.cwd(), 'dist');
const startedAt = new Date().toISOString();

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);

    if (url.pathname === '/health' && request.method === 'GET') {
      return sendJson(response, 200, {
        ok: true,
        service: 'generator-wiazki-kablowej',
        startedAt,
        uptimeSeconds: Math.round(process.uptime()),
      });
    }

    if (url.pathname === '/api/bootstrap' && request.method === 'GET') {
      return sendJson(response, 200, getBootstrapPayload());
    }

    if (url.pathname === '/api/state' && request.method === 'PUT') {
      const payload = await readJsonBody<AppStatePayload>(request);
      const result = saveState(payload);
      return sendJson(response, 200, result);
    }

    if (url.pathname === '/api/configurations' && request.method === 'POST') {
      const payload = await readJsonBody<SavedConfiguration>(request);
      return sendJson(response, 200, upsertConfiguration(payload));
    }

    if (url.pathname.startsWith('/api/configurations/') && request.method === 'DELETE') {
      const id = decodeURIComponent(url.pathname.replace('/api/configurations/', ''));
      deleteConfiguration(id);
      return sendJson(response, 200, { ok: true });
    }

    if (url.pathname === '/api/export/xlsx' && request.method === 'POST') {
      const payload = await readJsonBody<DocumentExportPayload>(request);
      const buffer = createXlsxBuffer(payload);
      return sendBinary(
        response,
        200,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        `${sanitizeFileName(payload.configurationName || 'cabling')}.xlsx`,
        Buffer.from(buffer),
      );
    }

    if (url.pathname === '/api/export/pdf' && request.method === 'POST') {
      const payload = await readJsonBody<DocumentExportPayload>(request);
      const bytes = await createPdfBytes(payload);
      return sendBinary(
        response,
        200,
        'application/pdf',
        `${sanitizeFileName(payload.configurationName || 'cabling')}.pdf`,
        Buffer.from(bytes),
      );
    }

    if (request.method === 'GET') {
      return serveStatic(url.pathname, response);
    }

    return sendJson(response, 404, { error: 'Nie znaleziono zasobu.' });
  } catch (error) {
    console.error(error);
    return sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'Nieznany blad.',
    });
  }
});

server.listen(port, host, () => {
  console.log(`Cabling backend listening on http://${host}:${port}`);
});

async function readJsonBody<T>(request: IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const raw = stripBom(Buffer.concat(chunks).toString('utf8'));
  return raw ? (JSON.parse(raw) as T) : ({} as T);
}

function sendJson(response: ServerResponse, statusCode: number, data: unknown) {
  const json = JSON.stringify(data);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(json),
  });
  response.end(json);
}

function sendBinary(
  response: ServerResponse,
  statusCode: number,
  contentType: string,
  fileName: string,
  buffer: Buffer,
) {
  response.writeHead(statusCode, {
    'Content-Type': contentType,
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Content-Length': buffer.length,
  });
  response.end(buffer);
}

function serveStatic(pathname: string, response: ServerResponse) {
  if (!fs.existsSync(distDir)) {
    return sendJson(response, 200, {
      message: 'Brakuje zbudowanego frontendu. Uruchom npm run dev albo npm run build.',
    });
  }

  const normalizedPath = pathname === '/' ? '/index.html' : pathname;
  const requestedPath = path.resolve(distDir, `.${normalizedPath}`);
  const isSafePath = requestedPath.startsWith(distDir);
  const filePath = isSafePath && fs.existsSync(requestedPath) && fs.statSync(requestedPath).isFile()
    ? requestedPath
    : path.join(distDir, 'index.html');
  const ext = path.extname(filePath);
  const contentType = contentTypeForExtension(ext);
  const buffer = fs.readFileSync(filePath);

  response.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': buffer.length,
  });
  response.end(buffer);
}

function contentTypeForExtension(extension: string) {
  switch (extension) {
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'application/javascript; charset=utf-8';
    case '.css':
      return 'text/css; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.svg':
      return 'image/svg+xml';
    case '.png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
}

function sanitizeFileName(value: string) {
  return value.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'cabling';
}

