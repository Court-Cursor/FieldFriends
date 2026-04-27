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

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <section className="panel">
      <h1>Upcoming Events</h1>
      {error ? <p className="error">{error}</p> : null}
      {events.length === 0 ? <p>No upcoming events found.</p> : null}
      <ul className="event-list">
        {events.map((event) => (
          <li key={event.id}>
            <div className="event-card">
              <div className="event-card-header">
                <Link to={`/events/${event.id}`}>{event.title}</Link>
                {event.sport_type ? <span className="sport-badge">{event.sport_type}</span> : null}
              </div>
              <div className="event-card-meta">
                <span>📍 {event.location_text}</span>
                <span>🗓 {formatDate(event.start_time)}</span>
              </div>
              <div className="event-card-footer">
                <span className="joined-count">👥 {event.joined_count} joined</span>
                {token ? (
                  user && event.creator_id === user.id ? (
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => deleteEvent(event.id)}
                      disabled={busyEventId === event.id}
                    >
                      {busyEventId === event.id ? "Deleting..." : "Delete"}
                    </button>
                  ) : event.is_joined_by_me ? (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => leaveEvent(event.id)}
                      disabled={busyEventId === event.id}
                    >
                      {busyEventId === event.id ? "Leaving..." : "Leave"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => joinEvent(event.id)}
                      disabled={busyEventId === event.id}
                    >
                      {busyEventId === event.id ? "Joining..." : "Join"}
                    </button>
                  )
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
