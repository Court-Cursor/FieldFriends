import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { ApiError, apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { EventItem } from "../types";

export function EventDetailPage() {
  const { eventId } = useParams();
  const { token, user } = useAuth();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      return;
    }

    setLoading(true);
    apiClient
      .getEvent(eventId, token ?? undefined)
      .then(setEvent)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load event"))
      .finally(() => setLoading(false));
  }, [eventId, token]);

  async function joinEvent() {
    if (!eventId || !token) {
      return;
    }
    setError(null);
    try {
      const joined = await apiClient.joinEvent(eventId, token);
      setEvent(joined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to join event");
    }
  }

  if (loading) {
    return <p>Loading event...</p>;
  }

  if (!event) {
    return <p>Event not found.</p>;
  }

  return (
    <section className="panel">
      <h1>{event.title}</h1>
      <p>{event.description ?? "No description"}</p>
      <p>Sport: {event.sport_type ?? "N/A"}</p>
      <p>Location: {event.location_text}</p>
      <p>Starts: {new Date(event.start_time).toLocaleString()}</p>
      <p>Ends: {new Date(event.end_time).toLocaleString()}</p>
      <p>Joined: {event.joined_count}</p>
      {user ? (
        <button type="button" onClick={joinEvent} disabled={event.is_joined_by_me === true}>
          {event.is_joined_by_me ? "Joined" : "Join Event"}
        </button>
      ) : (
        <p>Log in to join this event.</p>
      )}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
