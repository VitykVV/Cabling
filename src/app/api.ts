import type { AppStatePayload, BootstrapPayload, DocumentExportPayload, SaveStateResult, SavedConfiguration } from '../shared/types.ts';

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `Zadanie nie powiodlo sie. Kod odpowiedzi: ${response.status}.`);
  }
  return text ? (JSON.parse(text) as T) : ({} as T);
}

export async function fetchBootstrap() {
  const response = await fetch('/api/bootstrap');
  return readJson<BootstrapPayload>(response);
}

export async function saveState(payload: AppStatePayload) {
  const response = await fetch('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  return readJson<SaveStateResult>(response);
}

export async function saveConfiguration(configuration: SavedConfiguration) {
  const response = await fetch('/api/configurations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(configuration),
  });
  return readJson<SavedConfiguration>(response);
}

export async function removeConfiguration(id: string) {
  const response = await fetch(`/api/configurations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
  return readJson<{ ok: boolean }>(response);
}

export async function downloadExport(kind: 'pdf' | 'xlsx', payload: DocumentExportPayload) {
  const response = await fetch(`/api/export/${kind}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const blob = await response.blob();
  const disposition = response.headers.get('content-disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const fileName = match?.[1] ?? `cabling.${kind}`;
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

