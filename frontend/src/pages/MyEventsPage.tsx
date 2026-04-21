import { useEffect, useState } from "react";

import { ApiError, apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { EventItem, MyEventsResponse } from "../types";

function EventGroup({
  title,
  events,
  actionLabel,
  onAction,
  deletingEventId,
}: {
  title: string;
  events: EventItem[];
  actionLabel?: string;
  onAction?: (eventId: string) => void;
  deletingEventId?: string | null;
}) {
  return (
    <div>
      <h2>{title}</h2>
      {events.length === 0 ? <p>None</p> : null}
      <ul className="event-list">
        {events.map((event) => (
          <li key={event.id}>
            <strong>{event.title}</strong>
            <p>{event.location_text}</p>
            <p>{new Date(event.start_time).toLocaleString()}</p>
            <p>Joined: {event.joined_count}</p>
            {event.participants && event.participants.length > 0 ? (
              <div>
                <p>Participants:</p>
                <ul>
                  {event.participants.map((participant) => (
                    <li key={participant.user_id}>{participant.email}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {onAction ? (
              <button type="button" onClick={() => onAction(event.id)} disabled={deletingEventId === event.id}>
                {deletingEventId === event.id ? "Working..." : actionLabel ?? "Action"}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MyEventsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<MyEventsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      return;
    }

    apiClient
      .myEvents(token)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load my events"));
  }, [token]);

  async function deleteEvent(eventId: string) {
    if (!token) {
      return;
    }

    setError(null);
    setDeletingEventId(eventId);
    try {
      await apiClient.deleteEvent(eventId, token);
      const refreshed = await apiClient.myEvents(token);
      setData(refreshed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete event");
    } finally {
      setDeletingEventId(null);
    }
  }

  async function leaveEvent(eventId: string) {
    if (!token) {
      return;
    }

    setError(null);
    setDeletingEventId(eventId);
    try {
      await apiClient.leaveEvent(eventId, token);
      const refreshed = await apiClient.myEvents(token);
      setData(refreshed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to leave event");
    } finally {
      setDeletingEventId(null);
    }
  }

  if (error) {
    return <p className="error">{error}</p>;
  }

  if (!data) {
    return <p>Loading...</p>;
  }

  return (
    <section className="panel">
      <h1>My Events</h1>
      <EventGroup
        title="Created"
        events={data.created_events}
        actionLabel="Delete Event"
        onAction={deleteEvent}
        deletingEventId={deletingEventId}
      />
      <EventGroup
        title="Joined"
        events={data.joined_events}
        actionLabel="Leave Event"
        onAction={leaveEvent}
        deletingEventId={deletingEventId}
      />
    </section>
  );
}
