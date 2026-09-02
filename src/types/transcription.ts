export interface TranscriptionSession {
  id: string;
  room_code?: string;
  external_meeting_url?: string;
  calendar_event_id?: string;
  title: string;
  started_at: string;
  ended_at?: string;
  created_by: string;
  etablissement_id?: string;
  partenaire_id?: string;
  groupe_id?: string;
  status: 'active' | 'ended' | 'processing' | 'archived';
  summary?: string;
  decisions: TranscriptionDecision[];
  next_steps: TranscriptionNextStep[];
  full_transcript?: string;
  language: string;
  created_at: string;
  updated_at: string;
}

export interface TranscriptionSegment {
  id: string;
  session_id: string;
  user_id?: string;
  speaker_name: string;
  speaker_id?: string;
  text: string;
  start_time_ms?: number;
  end_time_ms?: number;
  is_partial: boolean;
  confidence?: number;
  created_at: string;
}

export interface TranscriptionParticipant {
  id: string;
  session_id: string;
  user_id?: string;
  display_name: string;
  azure_speaker_id?: string;
  joined_at: string;
  left_at?: string;
  is_transcribing: boolean;
}

export interface TranscriptionDecision {
  decision: string;
  owner?: string;
}

export interface TranscriptionNextStep {
  task: string;
  assignee?: string;
  deadline?: string;
  priority?: 'haute' | 'moyenne' | 'basse';
}

export interface TranscriptionSessionWithDetails extends TranscriptionSession {
  participants?: TranscriptionParticipant[];
  segments?: TranscriptionSegment[];
}

export interface CreateSessionParams {
  title: string;
  roomCode?: string;
  externalMeetingUrl?: string;
  etablissementId?: string;
  partenaireId?: string;
  groupeId?: string;
  displayName: string;
  language?: string;
}
