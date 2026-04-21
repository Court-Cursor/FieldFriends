import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ApiError, apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { EventItem } from "../types";

export function EventListPage() {
  const { token, user } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);

  useEffect(() => {
    async function loadEvents() {
      try {
        const listed = await apiClient.listEvents(token ?? undefined);
        if (!token) {
          setEvents(listed);
          return;
        }

        const joinedEvents = listed.filter((event) => event.is_joined_by_me);
        if (joinedEvents.length === 0) {
          setEvents(listed);
          return;
        }

        const detailedJoined = await Promise.all(
          joinedEvents.map(async (event) => apiClient.getEvent(event.id, token)),
        );
        const detailedById = new Map(detailedJoined.map((event) => [event.id, event]));
        setEvents(listed.map((event) => detailedById.get(event.id) ?? event));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Failed to load events");
      } finally {
        setLoading(false);
      }
    }

    loadEvents();
  }, [token]);

  if (loading) {
    return <p>Loading events...</p>;
  }

  if (error) {
    return <p className="error">{error}</p>;
  }

  async function joinEvent(eventId: string) {
    if (!token) {
      return;
    }

    setError(null);
    setBusyEventId(eventId);
    try {
      await apiClient.joinEvent(eventId, token);
      const updated = await apiClient.getEvent(eventId, token);
      setEvents((prev) => prev.map((event) => (event.id === eventId ? updated : event)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to join event");
    } finally {
      setBusyEventId(null);
    }
  }

  async function leaveEvent(eventId: string) {
    if (!token) {
      return;
    }

    setError(null);
    setBusyEventId(eventId);
    try {
      const updated = await apiClient.leaveEvent(eventId, token);
      setEvents((prev) => prev.map((event) => (event.id === eventId ? updated : event)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to leave event");
    } finally {
      setBusyEventId(null);
    }
  }

  async function deleteEvent(eventId: string) {
    if (!token) {
      return;
    }

    setError(null);
    setBusyEventId(eventId);
    try {
      await apiClient.deleteEvent(eventId, token);
      setEvents((prev) => prev.filter((event) => event.id !== eventId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete event");
    } finally {
      setBusyEventId(null);
    }
  }

  return (
    <section className="panel">
      <h1>Upcoming Events</h1>
      {events.length === 0 ? <p>No upcoming events found.</p> : null}
      <ul className="event-list">
        {events.map((event) => (
          <li key={event.id}>
            <Link to={`/events/${event.id}`}>{event.title}</Link>
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
            {token ? (
              user && event.creator_id === user.id ? (
                <button type="button" onClick={() => deleteEvent(event.id)} disabled={busyEventId === event.id}>
                  {busyEventId === event.id ? "Deleting..." : "Delete Event"}
                </button>
              ) : event.is_joined_by_me ? (
                <button type="button" onClick={() => leaveEvent(event.id)} disabled={busyEventId === event.id}>
                  {busyEventId === event.id ? "Leaving..." : "Leave Event"}
                </button>
              ) : (
                <button type="button" onClick={() => joinEvent(event.id)} disabled={busyEventId === event.id}>
                  {busyEventId === event.id ? "Joining..." : "Join Event"}
                </button>
              )
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
