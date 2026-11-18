import { Fragment, type ReactNode } from 'react';

/** Subconjunto de Markdown que usan los LLM en chat: **negrita**, listas, títulos y párrafos. Sin HTML crudo. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;

  const flush = () => {
    if (!list) return;
    const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>);
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = null;
  };

  for (const raw of text.split('\n')) {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*•]\s+(.*)/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (bullet || numbered) {
      const ordered = Boolean(numbered);
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? numbered)![1]!);
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const heading = line.match(/^#{1,4}\s+(.*)/);
    blocks.push(heading ? <p key={blocks.length}><strong>{inline(heading[1]!)}</strong></p> : <p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <>{blocks}</>;
}
