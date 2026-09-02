/* @vitest-environment jsdom */

import { describe, it, expect } from 'vitest';
import {
  BEHAVIORAL_EVENT_LABELS,
  ATTRIBUTION_CHANNEL_LABELS,
  SCORE_TIERS,
  getScoreTier,
  type BehavioralEvent,
  type AttributionTouchpoint,
  type ScoreSnapshot,
  type BehavioralScoreResult,
  type AttributionResult,
} from './scoring';

describe('scoring', () => {
  describe('BEHAVIORAL_EVENT_LABELS', () => {
    it('mappe chaque type d’événement vers son libellé métier attendu', () => {
      expect(BEHAVIORAL_EVENT_LABELS.email_opened).toBe('Email ouvert');
      expect(BEHAVIORAL_EVENT_LABELS.email_clicked).toBe('Lien cliqué');
      expect(BEHAVIORAL_EVENT_LABELS.email_replied).toBe('Réponse email');
      expect(BEHAVIORAL_EVENT_LABELS.meeting_attended).toBe('RDV honoré');
      expect(BEHAVIORAL_EVENT_LABELS.meeting_no_show).toBe('RDV manqué');
      expect(BEHAVIORAL_EVENT_LABELS.task_completed).toBe('Tâche terminée');
      expect(BEHAVIORAL_EVENT_LABELS.document_viewed).toBe('Document consulté');
      expect(BEHAVIORAL_EVENT_LABELS.quick_response).toBe('Réponse rapide (<4h)');
    });

    it('contient exactement 8 types comportementaux', () => {
      expect(Object.keys(BEHAVIORAL_EVENT_LABELS)).toHaveLength(8);
    });
  });

  describe('ATTRIBUTION_CHANNEL_LABELS', () => {
    it('mappe chaque canal d’attribution vers son libellé métier attendu', () => {
      expect(ATTRIBUTION_CHANNEL_LABELS.email_outbound).toBe('Email sortant');
      expect(ATTRIBUTION_CHANNEL_LABELS.email_inbound).toBe('Email entrant');
      expect(ATTRIBUTION_CHANNEL_LABELS.meeting).toBe('Rendez-vous');
      expect(ATTRIBUTION_CHANNEL_LABELS.call).toBe('Appel');
      expect(ATTRIBUTION_CHANNEL_LABELS.referral).toBe('Recommandation');
      expect(ATTRIBUTION_CHANNEL_LABELS.event).toBe('Événement');
      expect(ATTRIBUTION_CHANNEL_LABELS.document).toBe('Document');
      expect(ATTRIBUTION_CHANNEL_LABELS.task).toBe('Tâche');
      expect(ATTRIBUTION_CHANNEL_LABELS.other).toBe('Autre');
    });

    it('contient exactement 9 canaux d’attribution', () => {
      expect(Object.keys(ATTRIBUTION_CHANNEL_LABELS)).toHaveLength(9);
    });
  });

  describe('SCORE_TIERS', () => {
    it('définit les paliers métier dans le bon ordre décroissant de seuil', () => {
      expect(SCORE_TIERS).toEqual([
        { min: 80, label: 'Chaud', color: 'emerald' },
        { min: 60, label: 'Tiède', color: 'amber' },
        { min: 40, label: 'À travailler', color: 'orange' },
        { min: 0, label: 'Froid', color: 'red' },
      ]);
    });

    it('couvre correctement le score minimum à 0', () => {
      expect(SCORE_TIERS[SCORE_TIERS.length - 1]).toEqual({
        min: 0,
        label: 'Froid',
        color: 'red',
      });
    });
  });

  describe('getScoreTier', () => {
    it('retourne Chaud pour un score >= 80', () => {
      expect(getScoreTier(80)).toEqual({ min: 80, label: 'Chaud', color: 'emerald' });
      expect(getScoreTier(95)).toEqual({ min: 80, label: 'Chaud', color: 'emerald' });
    });

    it('retourne Tiède pour un score entre 60 et 79', () => {
      expect(getScoreTier(60)).toEqual({ min: 60, label: 'Tiède', color: 'amber' });
      expect(getScoreTier(79)).toEqual({ min: 60, label: 'Tiède', color: 'amber' });
    });

    it('retourne À travailler pour un score entre 40 et 59', () => {
      expect(getScoreTier(40)).toEqual({ min: 40, label: 'À travailler', color: 'orange' });
      expect(getScoreTier(59)).toEqual({ min: 40, label: 'À travailler', color: 'orange' });
    });

    it('retourne Froid pour un score entre 0 et 39', () => {
      expect(getScoreTier(0)).toEqual({ min: 0, label: 'Froid', color: 'red' });
      expect(getScoreTier(39)).toEqual({ min: 0, label: 'Froid', color: 'red' });
    });

    it('retourne aussi Froid pour un score négatif via le fallback', () => {
      expect(getScoreTier(-1)).toEqual({ min: 0, label: 'Froid', color: 'red' });
      expect(getScoreTier(-25)).toEqual({ min: 0, label: 'Froid', color: 'red' });
    });
  });

  describe('compatibilité des types exportés', () => {
    it('permet de construire un BehavioralEvent cohérent avec les labels', () => {
      const event: BehavioralEvent = {
        id: 'evt-1',
        etablissement_id: 'eta-1',
        contact_id: 'contact-1',
        event_type: 'email_replied',
        occurred_at: '2024-01-10T09:00:00Z',
        weight: 12,
        source_id: 'src-1',
        source_type: 'campaign',
        metadata: { direction: 'inbound' },
        created_at: '2024-01-10T09:00:00Z',
      };

      expect(event.weight).toBe(12);
      expect(BEHAVIORAL_EVENT_LABELS[event.event_type]).toBe('Réponse email');
    });

    it('permet de construire un AttributionTouchpoint cohérent avec les labels', () => {
      const touchpoint: AttributionTouchpoint = {
        id: 'tp-1',
        etablissement_id: 'eta-1',
        channel: 'meeting',
        occurred_at: '2024-02-01T14:00:00Z',
        weight: 30,
        user_id: 'user-1',
        source_id: 'src-2',
        source_type: 'calendar',
        metadata: { attended: true },
        created_at: '2024-02-01T14:00:00Z',
      };

      expect(touchpoint.weight).toBe(30);
      expect(ATTRIBUTION_CHANNEL_LABELS[touchpoint.channel]).toBe('Rendez-vous');
    });

    it('permet de construire un ScoreSnapshot et d’en déduire le bon tier', () => {
      const snapshot: ScoreSnapshot = {
        id: 'snap-1',
        etablissement_id: 'eta-1',
        score: 67,
        static_score: 40,
        behavioral_score: 27,
        engagement_velocity: 1.5,
        factors: [
          { label: 'Réponse email', points: 12, detail: 'Réponse récente' },
          { label: 'RDV honoré', points: 15, detail: 'Dernier rendez-vous honoré' },
        ],
        computed_at: '2024-03-01T08:00:00Z',
      };

      expect(snapshot.static_score + snapshot.behavioral_score).toBe(67);
      expect(getScoreTier(snapshot.score)).toEqual({ min: 60, label: 'Tiède', color: 'amber' });
    });

    it('permet de construire un BehavioralScoreResult avec last_event_at nullable', () => {
      const withLastEvent: BehavioralScoreResult = {
        behavioral_score: 24,
        engagement_velocity: 0.8,
        last_event_at: '2024-03-02T10:00:00Z',
        raw_score: 30,
      };

      const withoutLastEvent: BehavioralScoreResult = {
        behavioral_score: 0,
        engagement_velocity: 0,
        last_event_at: null,
        raw_score: 0,
      };

      expect(withLastEvent.last_event_at).toBe('2024-03-02T10:00:00Z');
      expect(withoutLastEvent.last_event_at).toBeNull();
    });

    it('permet de construire un AttributionResult complet', () => {
      const result: AttributionResult = {
        model: 'linear',
        by_channel: {
          email_outbound: 20,
          email_inbound: 10,
          meeting: 30,
          call: 15,
          referral: 5,
          event: 5,
          document: 10,
          task: 5,
          other: 0,
        },
        by_user: {
          'user-1': 60,
          'user-2': 40,
        },
        first_touch: {
          channel: 'email_outbound',
          occurred_at: '2024-01-01T09:00:00Z',
          user_id: 'user-1',
        },
        last_touch: {
          channel: 'meeting',
          occurred_at: '2024-01-15T15:00:00Z',
          user_id: 'user-2',
        },
      };

      expect(result.by_channel.meeting).toBe(30);
      expect(result.by_user['user-1']).toBe(60);
      expect(ATTRIBUTION_CHANNEL_LABELS[result.first_touch.channel]).toBe('Email sortant');
      expect(ATTRIBUTION_CHANNEL_LABELS[result.last_touch.channel]).toBe('Rendez-vous');
    });
  });
});