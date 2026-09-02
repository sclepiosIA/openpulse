import {
  AVAILABILITY_LABELS,
  REMINDER_OPTIONS,
  CALENDAR_COLORS,
  EVENT_STATUS_LABELS,
  ATTENDEE_STATUS_LABELS,
  ATTENDEE_ROLE_LABELS,
  createVideoProviders,
  VIDEO_PROVIDERS,
  detectProviderFromUrl,
  generateRoomId,
} from './calendar';

describe('calendar.ts constants', () => {
  it('exposes business labels with expected French values', () => {
    expect(AVAILABILITY_LABELS.busy).toBe('Occupé');
    expect(AVAILABILITY_LABELS.free).toBe('Disponible pour des réunions');

    expect(EVENT_STATUS_LABELS.confirmed).toBe('Confirmé');
    expect(EVENT_STATUS_LABELS.tentative).toBe('Provisoire');
    expect(EVENT_STATUS_LABELS.cancelled).toBe('Annulé');

    expect(ATTENDEE_STATUS_LABELS.pending).toBe('En attente');
    expect(ATTENDEE_STATUS_LABELS.accepted).toBe('Accepté');
    expect(ATTENDEE_STATUS_LABELS.declined).toBe('Refusé');
    expect(ATTENDEE_STATUS_LABELS.tentative).toBe('Peut-être');

    expect(ATTENDEE_ROLE_LABELS.organizer).toBe('Organisateur');
    expect(ATTENDEE_ROLE_LABELS.required).toBe('Requis');
    expect(ATTENDEE_ROLE_LABELS.optional).toBe('Optionnel');
  });

  it('exposes reminder options in the expected order with real values', () => {
    expect(REMINDER_OPTIONS).toHaveLength(8);
    expect(REMINDER_OPTIONS[0]).toEqual({ value: 0, label: "Au moment de l'événement" });
    expect(REMINDER_OPTIONS[1]).toEqual({ value: 5, label: '5 minutes avant' });
    expect(REMINDER_OPTIONS[2]).toEqual({ value: 15, label: '15 minutes avant' });
    expect(REMINDER_OPTIONS[3]).toEqual({ value: 30, label: '30 minutes avant' });
    expect(REMINDER_OPTIONS[4]).toEqual({ value: 60, label: '1 heure avant' });
    expect(REMINDER_OPTIONS[5]).toEqual({ value: 120, label: '2 heures avant' });
    expect(REMINDER_OPTIONS[6]).toEqual({ value: 1440, label: '1 jour avant' });
    expect(REMINDER_OPTIONS[7]).toEqual({ value: 10080, label: '1 semaine avant' });
  });

  it('exposes the supported calendar colors', () => {
    expect(CALENDAR_COLORS).toEqual([
      '#3B82F6',
      '#10B981',
      '#F59E0B',
      '#EF4444',
      '#8B5CF6',
      '#EC4899',
      '#06B6D4',
      '#84CC16',
      '#F97316',
      '#6366F1',
    ]);
  });
});

describe('createVideoProviders', () => {
  it('ne fabrique aucun lien quand aucune URL d\'infrastructure n\'est configuree', () => {
    const providers = createVideoProviders();

    expect(providers.map((p) => p.id)).toEqual([
      'none',
      'marque',
      'jitsi',
      'meet',
      'teams',
      'zoom',
      'nextcloud',
      'custom',
    ]);

    const none = providers.find((p) => p.id === 'none');
    const marque = providers.find((p) => p.id === 'marque');
    const jitsi = providers.find((p) => p.id === 'jitsi');
    const nextcloud = providers.find((p) => p.id === 'nextcloud');
    const meet = providers.find((p) => p.id === 'meet');

    expect(none?.generateLink('ignored')).toBe('');
    expect(marque?.generateLink('consult')).toBe('/visio/consult');
    expect(jitsi?.generateLink('room-42')).toBe('');
    expect(nextcloud?.generateLink('abc')).toBe('');
    expect(marque?.isInstant).toBe(true);
    expect(meet?.requiresOAuth).toBe(true);
  });

  it('uses provided infrastructure URLs for jitsi and nextcloud', () => {
    const providers = createVideoProviders({
      jitsi_url: 'https://visio.example.test',
      nextcloud_url: 'https://cloud.example.test',
    });

    const jitsi = providers.find((p) => p.id === 'jitsi');
    const nextcloud = providers.find((p) => p.id === 'nextcloud');
    const custom = providers.find((p) => p.id === 'custom');
    const meet = providers.find((p) => p.id === 'meet');
    const teams = providers.find((p) => p.id === 'teams');
    const zoom = providers.find((p) => p.id === 'zoom');

    expect(jitsi?.generateLink('team-sync')).toBe('https://visio.example.test/team-sync');
    expect(nextcloud?.generateLink('room-x')).toBe('https://cloud.example.test/call/room-x');
    expect(custom?.generateLink('https://custom.local/room')).toBe('https://custom.local/room');
    expect(meet?.oauthProvider).toBe('google');
    expect(teams?.oauthProvider).toBe('microsoft');
    expect(zoom?.oauthProvider).toBe('zoom');
  });

  it('garde VIDEO_PROVIDERS aligne sur la fabrique, sans lien par defaut', () => {
    expect(VIDEO_PROVIDERS.map((p) => p.id)).toEqual(createVideoProviders().map((p) => p.id));

    const defaultJitsi = VIDEO_PROVIDERS.find((p) => p.id === 'jitsi');
    const defaultNextcloud = VIDEO_PROVIDERS.find((p) => p.id === 'nextcloud');

    expect(defaultJitsi?.generateLink('demo')).toBe('');
    expect(defaultNextcloud?.generateLink('demo')).toBe('');
  });
});

describe('detectProviderFromUrl', () => {
  it('detects each known provider from realistic URLs', () => {
    expect(detectProviderFromUrl('')).toBe('none');
    expect(detectProviderFromUrl('/visio/room-1')).toBe('marque');
    expect(detectProviderFromUrl('https://meet.google.com/abc-defg-hij')).toBe('meet');
    expect(detectProviderFromUrl('https://teams.microsoft.com/l/meetup-join/123')).toBe('teams');
    expect(detectProviderFromUrl('https://acme.zoom.us/j/123456')).toBe('zoom');
    expect(detectProviderFromUrl('https://jitsi.exploitant.example.org/room')).toBe('jitsi');
    expect(detectProviderFromUrl('https://meet.jit.si/room')).toBe('jitsi');
    expect(detectProviderFromUrl('https://jitsi.example.test/room')).toBe('jitsi');
    expect(detectProviderFromUrl('https://cloud.example.test/call/room-9')).toBe('nextcloud');
    expect(detectProviderFromUrl('https://nextcloud.example.test/apps/spreed/room')).toBe('nextcloud');
  });

  it('falls back to custom for unknown URLs', () => {
    expect(detectProviderFromUrl('https://example.test/meeting')).toBe('custom');
  });
});

describe('generateRoomId', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('slugifies title, removes accents and appends deterministic random suffix', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.123456789);

    const roomId = generateRoomId('Réunion Générale équipe!');

    expect(roomId).toMatch(/^reunion-general-[a-z0-9]{6}$/);
    expect(roomId.startsWith('reunion-general-')).toBe(true);
  });

  it('limits slug to 15 characters before adding suffix', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.987654321);

    const roomId = generateRoomId('Titre extrêmement long pour dépassement');

    expect(roomId).toMatch(/^titre-extrememe-[a-z0-9]{6}$/);
    expect(roomId.startsWith('titre-extrememe-')).toBe(true);
  });

  it('returns only the suffix when title produces an empty slug', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.314159265);

    const roomId = generateRoomId('---___***');

    expect(roomId).toMatch(/^[a-z0-9]{6}$/);
  });

  it('uses native randomness again after mock restoration', () => {
    const deterministic = vi.spyOn(Math, 'random').mockReturnValue(0.111111111);
    const mockedRoomId = generateRoomId('Simple title');
    expect(mockedRoomId).toBe('simple-title-3zzzzz');

    deterministic.mockRestore();

    const roomId = generateRoomId('Simple title');
    expect(roomId.startsWith('simple-title-')).toBe(true);
    expect(roomId).toMatch(/^simple-title-[a-z0-9]{6}$/);
    expect(roomId).not.toBe('simple-title-3zzzzz');
  });
});