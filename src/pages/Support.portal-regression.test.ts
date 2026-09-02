import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Support portail — arrivée et URL', () => {
  it('rafraîchit sous 15 s et synchronise sélection/désélection avec ?ticket=', () => {
    const hooks = fs.readFileSync(`${process.cwd()}/src/hooks/support/useSupportTickets.ts`, 'utf8');
    const page = fs.readFileSync(`${process.cwd()}/src/pages/Support.tsx`, 'utf8');
    expect(hooks).toContain('refetchInterval: 10 * 1000');
    expect(page).toContain("next.set('ticket', ticketId)");
    expect(page).toContain("next.delete('ticket')");
    expect(page).toContain('<TabsTrigger value="list" onClick={handleClearSelectedTicket}>');
    expect(page).toContain('const nextTicketId = ticketParam || null');
    expect(page).toContain('current === nextTicketId ? current : nextTicketId');
  });
});
