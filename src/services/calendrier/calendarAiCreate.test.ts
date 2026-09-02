import { callCalendarAiCreate, type CalendarAiCreatePayload } from './calendarAiCreate';

const { mockInvoke, SUCCESS_DATA, ERROR_OBJ, PAYLOAD } = vi.hoisted(() => ({
  mockInvoke: vi.fn(),
  SUCCESS_DATA: {
    events: [
      { title: 'Réunion équipe', start: '2026-06-10T09:00:00Z', end: '2026-06-10T10:00:00Z' },
      { title: 'Déjeuner client', start: '2026-06-10T12:00:00Z', end: '2026-06-10T13:30:00Z' },
    ],
    interpretation: 'Création de deux événements à partir du texte',
  },
  ERROR_OBJ: { message: 'x' },
  PAYLOAD: {
    text: 'Planifie une réunion équipe à 9h puis un déjeuner client à midi',
    calendars: [
      { id: 'cal-1', name: 'Travail' },
      { id: 'cal-2', name: 'Perso' },
    ],
  } satisfies CalendarAiCreatePayload,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: {
      invoke: mockInvoke,
    },
    from: vi.fn(),
  },
}));

describe('callCalendarAiCreate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('appelle la fonction edge avec le bon nom et le bon payload puis retourne les données métier', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: SUCCESS_DATA,
      error: null,
    });

    const result = await callCalendarAiCreate(PAYLOAD);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('calendar-ai-create', {
      body: PAYLOAD,
    });

    expect(result).toEqual(SUCCESS_DATA);
    expect(result.interpretation).toBe('Création de deux événements à partir du texte');
    expect(result.events).toHaveLength(2);
    expect(result.events?.[0]).toMatchObject({
      title: 'Réunion équipe',
      start: '2026-06-10T09:00:00Z',
      end: '2026-06-10T10:00:00Z',
    });
    expect(result.events?.[1]).toMatchObject({
      title: 'Déjeuner client',
      start: '2026-06-10T12:00:00Z',
      end: '2026-06-10T13:30:00Z',
    });
  });

  it('retourne un objet vide quand supabase renvoie data null sans erreur', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const result = await callCalendarAiCreate(PAYLOAD);

    expect(mockInvoke).toHaveBeenCalledWith('calendar-ai-create', {
      body: PAYLOAD,
    });
    expect(result).toEqual({});
    expect(result.events).toBeUndefined();
    expect(result.interpretation).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it('propage l’erreur quand la fonction supabase échoue', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: null,
      error: ERROR_OBJ,
    });

    await expect(callCalendarAiCreate(PAYLOAD)).rejects.toEqual(ERROR_OBJ);

    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith('calendar-ai-create', {
      body: PAYLOAD,
    });
  });
});