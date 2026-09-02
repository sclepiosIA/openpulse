import { describe, it, expect } from 'vitest';
import { CARD_CONFIG, getCardConfig, getQuickActions } from '../cardConfig';

describe('cardConfig', () => {
  describe('CARD_CONFIG', () => {
    it('has 3 phases', () => expect(Object.keys(CARD_CONFIG)).toEqual(['prospect', 'deploiement', 'production']));

    it('prospect has currency + percent metrics', () => {
      const { metrics } = CARD_CONFIG.prospect;
      expect(metrics.length).toBe(2);
      expect(metrics[0].format).toBe('currency');
      expect(metrics[1].format).toBe('percent');
    });

    it('deploiement shows progress bar', () => expect(CARD_CONFIG.deploiement.showProgressBar).toBe(true));
    it('production hides progress bar', () => expect(CARD_CONFIG.production.showProgressBar).toBe(false));
    it('production shows alerts', () => expect(CARD_CONFIG.production.showAlerts).toBe(true));
    it('prospect hides alerts', () => expect(CARD_CONFIG.prospect.showAlerts).toBe(false));

    it('all phases have quickActions', () => {
      Object.values(CARD_CONFIG).forEach(cfg => {
        expect(cfg.quickActions.length).toBeGreaterThan(0);
        cfg.quickActions.forEach(a => {
          expect(a.id).toBeTruthy();
          expect(a.getUrl('test-id')).toContain('test-id');
        });
      });
    });

    it('all phases have teamMembers', () => {
      expect(CARD_CONFIG.prospect.teamMembers).toContain('commercial');
      expect(CARD_CONFIG.deploiement.teamMembers).toContain('chef_projet');
      expect(CARD_CONFIG.production.teamMembers).toContain('csm');
    });
  });

  describe('getCardConfig', () => {
    it('returns prospect config', () => expect(getCardConfig('prospect').showProgressBar).toBe(true));
    it('returns production config', () => expect(getCardConfig('production').metrics.length).toBe(4));
  });

  describe('getQuickActions', () => {
    it('prospect → 2 actions', () => expect(getQuickActions('prospect').length).toBe(2));
    it('deploiement → 3 actions', () => expect(getQuickActions('deploiement').length).toBe(3));
    it('production → 2 actions', () => expect(getQuickActions('production').length).toBe(2));
  });
});
