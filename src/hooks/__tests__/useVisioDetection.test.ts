import { describe, it, expect } from 'vitest';
import { detectVisioLink } from '../meeting/useVisioDetection';

describe('detectVisioLink', () => {
  it('detects OpenPulse Meet links', () => {
    const result = detectVisioLink('Rejoins la visio /visio/abc-123-def');
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('marque_meet');
    expect(result!.roomCode).toBe('abc-123-def');
  });

  it('detects Google Meet links', () => {
    const result = detectVisioLink('Join https://meet.google.com/abc-defg-hij');
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('google_meet');
    expect(result!.roomCode).toBe('abc-defg-hij');
  });

  it('detects Teams links', () => {
    const result = detectVisioLink('Join https://teams.microsoft.com/l/meetup-join/19%3ameeting');
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('teams');
  });

  it('detects Zoom links', () => {
    const result = detectVisioLink('Meeting https://zoom.us/j/1234567890?pwd=abc');
    expect(result).not.toBeNull();
    expect(result!.provider).toBe('zoom');
    expect(result!.roomCode).toBe('1234567890');
  });

  it('returns null for no visio link', () => {
    expect(detectVisioLink('Just a normal text')).toBeNull();
  });

  it('prioritizes OpenPulse Meet over others', () => {
    const result = detectVisioLink('/visio/room-123');
    expect(result!.provider).toBe('marque_meet');
  });
});
