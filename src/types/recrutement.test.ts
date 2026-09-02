import {
  CANDIDATE_PIPELINE_COLUMNS,
  CONTRACT_TYPE_LABELS,
  JOB_STATUS_LABELS,
  CANDIDATE_STATUS_LABELS,
  CANDIDATE_SOURCES,
} from './recrutement';

describe('recrutement constants', () => {
  it('defines CONTRACT_TYPE_LABELS with correct mappings', () => {
    const keys = Object.keys(CONTRACT_TYPE_LABELS);
    expect(keys.sort()).toEqual(['alternance', 'cdd', 'cdi', 'freelance', 'interim', 'stage'].sort());

    expect(CONTRACT_TYPE_LABELS.cdi).toBe('CDI');
    expect(CONTRACT_TYPE_LABELS.cdd).toBe('CDD');
    expect(CONTRACT_TYPE_LABELS.stage).toBe('Stage');
    expect(CONTRACT_TYPE_LABELS.alternance).toBe('Alternance');
    expect(CONTRACT_TYPE_LABELS.freelance).toBe('Freelance');
    expect(CONTRACT_TYPE_LABELS.interim).toBe('Intérim');
  });

  it('defines JOB_STATUS_LABELS with correct mappings', () => {
    const keys = Object.keys(JOB_STATUS_LABELS);
    expect(keys.sort()).toEqual(['draft', 'filled', 'paused', 'published', 'closed'].sort());

    expect(JOB_STATUS_LABELS.draft).toBe('Brouillon');
    expect(JOB_STATUS_LABELS.published).toBe('Publiée');
    expect(JOB_STATUS_LABELS.paused).toBe('En pause');
    expect(JOB_STATUS_LABELS.closed).toBe('Clôturée');
    expect(JOB_STATUS_LABELS.filled).toBe('Pourvue');
  });

  it('defines CANDIDATE_STATUS_LABELS with correct mappings', () => {
    const keys = Object.keys(CANDIDATE_STATUS_LABELS);
    expect(keys.sort()).toEqual(
      [
        'new',
        'screening',
        'phone_interview',
        'technical_interview',
        'final_interview',
        'offer_sent',
        'offer_accepted',
        'offer_declined',
        'rejected',
        'withdrawn',
      ].sort()
    );

    expect(CANDIDATE_STATUS_LABELS.new).toBe('Nouveau');
    expect(CANDIDATE_STATUS_LABELS.screening).toBe('Présélection');
    expect(CANDIDATE_STATUS_LABELS.phone_interview).toBe('Entretien Téléphonique');
    expect(CANDIDATE_STATUS_LABELS.technical_interview).toBe('Entretien Technique');
    expect(CANDIDATE_STATUS_LABELS.final_interview).toBe('Entretien Final');
    expect(CANDIDATE_STATUS_LABELS.offer_sent).toBe('Offre Envoyée');
    expect(CANDIDATE_STATUS_LABELS.offer_accepted).toBe('Offre Acceptée');
    expect(CANDIDATE_STATUS_LABELS.offer_declined).toBe('Offre Déclinée');
    expect(CANDIDATE_STATUS_LABELS.rejected).toBe('Rejeté');
    expect(CANDIDATE_STATUS_LABELS.withdrawn).toBe('Retiré');
  });

  it('defines CANDIDATE_PIPELINE_COLUMNS with expected statuses, labels, and colors', () => {
    expect(Array.isArray(CANDIDATE_PIPELINE_COLUMNS)).toBe(true);
    expect(CANDIDATE_PIPELINE_COLUMNS.length).toBe(7);

    const byStatus = Object.fromEntries(CANDIDATE_PIPELINE_COLUMNS.map(c => [c.status, c]));

    expect(Object.keys(byStatus).sort()).toEqual(
      [
        'new',
        'screening',
        'phone_interview',
        'technical_interview',
        'final_interview',
        'offer_sent',
        'offer_accepted',
      ].sort()
    );

    expect(byStatus.new.label).toBe('Nouveau');
    expect(byStatus.new.color).toBe('bg-gray-100 dark:bg-gray-800');

    expect(byStatus.screening.label).toBe('Présélection');
    expect(byStatus.screening.color).toBe('bg-blue-50 dark:bg-blue-900/20');

    expect(byStatus.phone_interview.label).toBe('Entretien Tél.');
    expect(byStatus.phone_interview.color).toBe('bg-indigo-50 dark:bg-indigo-900/20');

    expect(byStatus.technical_interview.label).toBe('Entretien Tech.');
    expect(byStatus.technical_interview.color).toBe('bg-purple-50 dark:bg-purple-900/20');

    expect(byStatus.final_interview.label).toBe('Entretien Final');
    expect(byStatus.final_interview.color).toBe('bg-pink-50 dark:bg-pink-900/20');

    expect(byStatus.offer_sent.label).toBe('Offre Envoyée');
    expect(byStatus.offer_sent.color).toBe('bg-amber-50 dark:bg-amber-900/20');

    expect(byStatus.offer_accepted.label).toBe('Acceptée');
    expect(byStatus.offer_accepted.color).toBe('bg-green-50 dark:bg-green-900/20');

    // Ensure pipeline does not include terminal negative statuses
    expect(byStatus.rejected).toBeUndefined();
    expect(byStatus.withdrawn).toBeUndefined();
    expect(byStatus.offer_declined).toBeUndefined();
  });

  it('defines CANDIDATE_SOURCES with expected values and no duplicates', () => {
    expect(CANDIDATE_SOURCES.length).toBe(8);
    expect(new Set(CANDIDATE_SOURCES).size).toBe(CANDIDATE_SOURCES.length);

    expect(CANDIDATE_SOURCES).toEqual(
      expect.arrayContaining([
        'Site carrières',
        'LinkedIn',
        'Indeed',
        'APEC',
        'Cooptation',
        'Cabinet de recrutement',
        'Candidature spontanée',
        'Autre',
      ])
    );
  });

  it('pipeline statuses are a subset of candidate status labels', () => {
    const statusSet = new Set(Object.keys(CANDIDATE_STATUS_LABELS));
    for (const column of CANDIDATE_PIPELINE_COLUMNS) {
      expect(statusSet.has(column.status)).toBe(true);
    }
  });
});