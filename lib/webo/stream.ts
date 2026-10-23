// Lecture du flux de /api/webo/chat dans le navigateur : une ligne JSON par événement.

import type { WeboEvent } from '@/server/webo/turn';

export async function streamWebo(
  body: { conversationId: string | null; text: string; path: string },
  onEvent: (e: WeboEvent) => void,
): Promise<void> {
  const res = await fetch('/api/webo/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok || !res.body) {
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    onEvent({ type: 'error', error: data?.error ?? 'Webo n’a pas pu répondre. Vérifiez votre connexion.' });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let ended = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: !done });
    let nl: number;
    while ((nl = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      try {
        const e = JSON.parse(line) as WeboEvent;
        if (e.type === 'done' || e.type === 'error') ended = true;
        onEvent(e);
      } catch { /* ligne illisible : ignorée */ }
    }
    if (done) break;
  }
  if (!ended) onEvent({ type: 'error', error: 'La réponse de Webo a été coupée. Rouvrez la conversation pour la voir.' });
}
