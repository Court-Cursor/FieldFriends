export interface UserSummary {
  id: string;
  email: string;
  created_at: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: UserSummary;
}

export interface EventItem {
  id: string;
  creator_id: string;
  title: string;
  sport_type: string | null;
  description: string | null;
  start_time: string;
  end_time: string;
  location_text: string;
  latitude: number | null;
  longitude: number | null;
  max_participants: number | null;
  created_at: string;
  joined_count: number;
  is_joined_by_me: boolean | null;
}

export interface EventCreatePayload {
  title: string;
  sport_type?: string;
  description?: string;
  start_time: string;
  end_time: string;
  location_text: string;
  latitude?: number;
  longitude?: number;
  max_participants?: number;
}

export interface MyEventsResponse {
  created_events: EventItem[];
  joined_events: EventItem[];
}
