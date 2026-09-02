// @vitest-environment jsdom

import { duplicateCalendarEvent } from './duplicateCalendarEvent';

const {
  ORIGINAL_EVENT,
  mockFrom,
  maybeSingleMock,
  insertMock,
  builder,
} = vi.hoisted(() => {
  const ORIGINAL_EVENT = {
    calendar_id: 'cal-1',
    title: 'Réunion équipe',
    description: 'Point hebdo',
    location: 'Salle A',
    video_conference_url: 'meet.local/room',
    all_day: false,
    status: 'confirmed',
    visibility: 'private',
    etablissement_id: 'eta-1',
    tache_id: 'task-1',
    color: '#3366ff',
    display_as_banner: true,
    availability: 'free',
  };

  const maybeSingleMock = vi.fn();
  const insertMock = vi.fn();

  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    gte: vi.fn(),
    lte: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    single: vi.fn(),
    maybeSingle: vi.fn(),
    then: vi.fn(),
    catch: vi.fn(),
  };

  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.gte.mockReturnValue(builder);
  builder.lte.mockReturnValue(builder);
  builder.in.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.limit.mockReturnValue(builder);
  builder.update.mockReturnValue(builder);
  builder.delete.mockReturnValue(builder);
  builder.single.mockResolvedValue({ data: null, error: null });
  builder.maybeSingle.mockImplementation(maybeSingleMock);
  builder.insert.mockImplementation(insertMock);
  builder.then.mockImplementation((onFulfilled: (value: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).then(onFulfilled),
  );
  builder.catch.mockImplementation((onRejected: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null }).catch(onRejected),
  );

  const mockFrom = vi.fn(() => builder);

  return {
    ORIGINAL_EVENT,
    mockFrom,
    maybeSingleMock,
    insertMock,
    builder,
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: mockFrom,
  },
}));

describe('duplicateCalendarEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue(builder);
    builder.select.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    builder.insert.mockImplementation(insertMock);
    builder.maybeSingle.mockImplementation(maybeSingleMock);

    maybeSingleMock.mockResolvedValue({
      data: ORIGINAL_EVENT,
      error: null,
    });

    insertMock.mockResolvedValue({
      data: [{ id: 'copy-1' }, { id: 'copy-2' }],
      error: null,
    });
  });

  it('duplique un événement sur plusieurs dates en conservant heure, durée et champs métier', async () => {
    const selectedDates = [new Date('2025-03-10T00:00:00.000Z'), new Date('2025-03-12T00:00:00.000Z')];
    const originalStart = new Date('2025-02-05T14:30:45.000Z');
    const durationMs = 90 * 60 * 1000;

    const count = await duplicateCalendarEvent({
      sourceId: 'src-1',
      selectedDates,
      originalStart,
      durationMs,
      createdBy: 'user-1',
    });

    expect(count).toBe(2);
    expect(mockFrom).toHaveBeenNthCalledWith(1, 'calendar_events');
    expect(mockFrom).toHaveBeenNthCalledWith(2, 'calendar_events');
    expect(builder.select).toHaveBeenCalledWith(
      'calendar_id, title, description, location, video_conference_url, all_day, status, visibility, etablissement_id, tache_id, color, display_as_banner, availability',
    );
    expect(builder.eq).toHaveBeenCalledWith('id', 'src-1');

    const expectedFirstStart = new Date(selectedDates[0]);
    expectedFirstStart.setHours(
      originalStart.getHours(),
      originalStart.getMinutes(),
      originalStart.getSeconds(),
      0,
    );
    const expectedSecondStart = new Date(selectedDates[1]);
    expectedSecondStart.setHours(
      originalStart.getHours(),
      originalStart.getMinutes(),
      originalStart.getSeconds(),
      0,
    );

    const expectedInserts = [
      {
        calendar_id: 'cal-1',
        title: 'Réunion équipe',
        description: 'Point hebdo',
        location: 'Salle A',
        video_conference_url: 'meet.local/room',
        start_time: expectedFirstStart.toISOString(),
        end_time: new Date(expectedFirstStart.getTime() + durationMs).toISOString(),
        all_day: false,
        status: 'confirmed',
        visibility: 'private',
        etablissement_id: 'eta-1',
        tache_id: 'task-1',
        color: '#3366ff',
        display_as_banner: true,
        availability: 'free',
        created_by: 'user-1',
      },
      {
        calendar_id: 'cal-1',
        title: 'Réunion équipe',
        description: 'Point hebdo',
        location: 'Salle A',
        video_conference_url: 'meet.local/room',
        start_time: expectedSecondStart.toISOString(),
        end_time: new Date(expectedSecondStart.getTime() + durationMs).toISOString(),
        all_day: false,
        status: 'confirmed',
        visibility: 'private',
        etablissement_id: 'eta-1',
        tache_id: 'task-1',
        color: '#3366ff',
        display_as_banner: true,
        availability: 'free',
        created_by: 'user-1',
      },
    ];

    expect(insertMock).toHaveBeenCalledWith(expectedInserts);
  });

  it('applique les valeurs par défaut display_as_banner=false et availability=busy si absentes', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: {
        calendar_id: 'cal-2',
        title: 'Cours',
        description: null,
        location: null,
        video_conference_url: null,
        all_day: true,
        status: 'tentative',
        visibility: 'public',
        etablissement_id: 'eta-2',
        tache_id: null,
        color: '#ff9900',
      },
      error: null,
    });

    const selectedDates = [new Date('2025-06-15T00:00:00.000Z')];
    const originalStart = new Date('2025-01-01T08:15:00.000Z');
    const durationMs = 30 * 60 * 1000;

    const count = await duplicateCalendarEvent({
      sourceId: 'src-2',
      selectedDates,
      originalStart,
      durationMs,
    });

    const expectedStart = new Date(selectedDates[0]);
    expectedStart.setHours(
      originalStart.getHours(),
      originalStart.getMinutes(),
      originalStart.getSeconds(),
      0,
    );

    expect(count).toBe(1);
    expect(insertMock).toHaveBeenCalledWith([
      {
        calendar_id: 'cal-2',
        title: 'Cours',
        description: null,
        location: null,
        video_conference_url: null,
        start_time: expectedStart.toISOString(),
        end_time: new Date(expectedStart.getTime() + durationMs).toISOString(),
        all_day: true,
        status: 'tentative',
        visibility: 'public',
        etablissement_id: 'eta-2',
        tache_id: null,
        color: '#ff9900',
        display_as_banner: false,
        availability: 'busy',
        created_by: undefined,
      },
    ]);
  });

  it('rejette si la récupération de l’événement source échoue', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'fetch failed' },
    });

    await expect(
      duplicateCalendarEvent({
        sourceId: 'src-err',
        selectedDates: [new Date('2025-07-01T00:00:00.000Z')],
        originalStart: new Date('2025-01-01T10:00:00.000Z'),
        durationMs: 60_000,
        createdBy: 'user-2',
      }),
    ).rejects.toMatchObject({ message: 'fetch failed' });

    expect(insertMock).not.toHaveBeenCalled();
  });

  it('rejette si l’événement source est introuvable', async () => {
    maybeSingleMock.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(
      duplicateCalendarEvent({
        sourceId: 'missing',
        selectedDates: [new Date('2025-07-02T00:00:00.000Z')],
        originalStart: new Date('2025-01-01T10:00:00.000Z'),
        durationMs: 60_000,
      }),
    ).rejects.toThrow('Événement introuvable');

    expect(insertMock).not.toHaveBeenCalled();
  });

  it('rejette si l’insertion des copies échoue', async () => {
    insertMock.mockResolvedValueOnce({
      data: null,
      error: { message: 'insert failed' },
    });

    await expect(
      duplicateCalendarEvent({
        sourceId: 'src-3',
        selectedDates: [new Date('2025-08-20T00:00:00.000Z')],
        originalStart: new Date('2025-02-02T16:45:30.000Z'),
        durationMs: 15 * 60 * 1000,
        createdBy: 'user-3',
      }),
    ).rejects.toMatchObject({ message: 'insert failed' });

    expect(insertMock).toHaveBeenCalledTimes(1);
  });
});