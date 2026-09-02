export type VisioProvider = 'marque_meet' | 'google_meet' | 'nextcloud_talk';

export interface VisioRoom {
  id: string;
  roomCode: string;
  name: string;
  status: 'waiting' | 'active' | 'ended';
  createdBy?: {
    id: string;
    nom: string;
    prenom: string;
    email: string;
  };
  conversationId?: string;
  calendarEventId?: string;
  participants: VisioParticipant[];
  startedAt?: string;
  endedAt?: string;
  maxParticipants: number;
}

export interface VisioParticipant {
  id: string;
  user_id: string;
  display_name: string;
  joined_at: string;
  left_at?: string;
  is_muted: boolean;
  is_video_off: boolean;
  is_screen_sharing: boolean;
  connection_quality: 'good' | 'fair' | 'poor';
  // Signaling data (used internally)
  sdp_offer?: RTCSessionDescriptionInit;
  sdp_answer?: RTCSessionDescriptionInit;
  ice_candidates?: RTCIceCandidateInit[];
}

export interface LocalMediaState {
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
}

export interface PeerConnection {
  peerId: string;
  connection: RTCPeerConnection;
  stream?: MediaStream;
}

export interface DeviceInfo {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'videoinput' | 'audiooutput';
}

export interface VisioSettings {
  audioInputDevice?: string;
  videoInputDevice?: string;
  audioOutputDevice?: string;
  videoQuality: 'low' | 'medium' | 'high';
  noiseSuppression: boolean;
  echoCancellation: boolean;
}

// STUN/TURN servers configuration
export const ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
  { urls: 'stun:stun3.l.google.com:19302' },
  { urls: 'stun:stun4.l.google.com:19302' },
];

export const VIDEO_CONSTRAINTS: Record<string, MediaTrackConstraints> = {
  low: { width: 320, height: 240, frameRate: 15 },
  medium: { width: 640, height: 480, frameRate: 24 },
  high: { width: 1280, height: 720, frameRate: 30 },
};
