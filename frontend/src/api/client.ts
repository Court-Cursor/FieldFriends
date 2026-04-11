import type { AuthResponse, EventCreatePayload, EventItem, MyEventsResponse, UserSummary } from "../types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (!response.ok) {
    let message = "Request failed";
    try {
      const body = await response.json();
      message = body.detail ?? message;
    } catch {
      message = response.statusText || message;
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return null as T;
  }

  const raw = await response.text();
  if (!raw) {
    return null as T;
  }

  return JSON.parse(raw) as T;
}

export const apiClient = {
  signup(email: string, password: string) {
    return request<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  login(email: string, password: string) {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  me(token: string) {
    return request<UserSummary>("/me", undefined, token);
  },

  listEvents(token?: string) {
    return request<EventItem[]>("/events", undefined, token);
  },

  getEvent(eventId: string, token?: string) {
    return request<EventItem>(`/events/${eventId}`, undefined, token);
  },

  createEvent(payload: EventCreatePayload, token: string) {
    return request<EventItem>("/events", {
      method: "POST",
      body: JSON.stringify(payload),
    }, token);
  },

  joinEvent(eventId: string, token: string) {
    return request<EventItem>(`/events/${eventId}/join`, { method: "POST" }, token);
  },

  leaveEvent(eventId: string, token: string) {
    return request<EventItem>(`/events/${eventId}/leave`, { method: "DELETE" }, token);
  },

  async deleteEvent(eventId: string, token: string) {
    await request<null>(`/events/${eventId}`, { method: "DELETE" }, token);
  },

  async removeParticipant(eventId: string, userId: string, token: string) {
    await request<null>(`/events/${eventId}/participants/${userId}`, { method: "DELETE" }, token);
  },

  myEvents(token: string) {
    return request<MyEventsResponse>("/users/me/events", undefined, token);
  },
};

export { ApiError };
