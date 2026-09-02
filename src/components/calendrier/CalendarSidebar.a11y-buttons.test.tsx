import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('CalendarSidebar a11y — accessible names on interactive controls', () => {
  it('all <button> elements have an accessible name (aria-label or visible text)', () => {
    const src = readFileSync(join(__dirname, 'CalendarSidebar.tsx'), 'utf8');

    // Collect every <button ...> opening tag (including multi-line).
    const tags: string[] = [];
    let i = 0;
    while (true) {
      const idx = src.indexOf('<button', i);
      if (idx < 0) break;
      let depth = 0;
      let j = idx + '<button'.length;
      while (j < src.length) {
        const c = src[j];
        if (c === '{') depth++;
        else if (c === '}') depth--;
        else if (c === '>' && depth === 0) break;
        j++;
      }
      tags.push(src.slice(idx, j + 1));
      i = j + 1;
    }

    expect(tags.length).toBeGreaterThan(0);
    for (const tag of tags) {
      const hasLabel =
        /aria-label\s*=/.test(tag) || /aria-labelledby\s*=/.test(tag);
      expect(
        hasLabel,
        `Native <button> without aria-label found:\n${tag}`,
      ).toBe(true);
    }
  });
});
