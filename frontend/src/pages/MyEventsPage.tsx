import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ApiError, apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { EventItem, MyEventsResponse } from "../types";

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function EventCard({
  event,
  actionLabel,
  actionClass,
  onAction,
  busy,
}: {
  event: EventItem;
  actionLabel: string;
  actionClass?: string;
  onAction: (eventId: string) => void;
  busy: boolean;
}) {
  return (
    <li>
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
          <button
            type="button"
            className={actionClass}
            onClick={() => onAction(event.id)}
            disabled={busy}
          >
            {busy ? "Working..." : actionLabel}
          </button>
        </div>
      </div>
    </li>
  );
}

export function MyEventsPage() {
  const { token } = useAuth();
  const [data, setData] = useState<MyEventsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"created" | "joined">("created");

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
    if (!token) return;
    setError(null);
    setBusyEventId(eventId);
    try {
      await apiClient.deleteEvent(eventId, token);
      const refreshed = await apiClient.myEvents(token);
      setData(refreshed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete event");
    } finally {
      setBusyEventId(null);
    }
  }

  async function leaveEvent(eventId: string) {
    if (!token) return;
    setError(null);
    setBusyEventId(eventId);
    try {
      await apiClient.leaveEvent(eventId, token);
      const refreshed = await apiClient.myEvents(token);
      setData(refreshed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to leave event");
    } finally {
      setBusyEventId(null);
    }
  }

  if (!data) {
    if (error) return <p className="error">{error}</p>;
    return <p>Loading...</p>;
  }

  const activeEvents = activeTab === "created" ? data.created_events : data.joined_events;

  return (
    <section className="panel">
      <h1>My Events</h1>
      {error ? <p className="error">{error}</p> : null}

      <div className="tabs">
        <button
          type="button"
          className={`tab-btn${activeTab === "created" ? " active" : ""}`}
          onClick={() => setActiveTab("created")}
        >
          Created ({data.created_events.length})
        </button>
        <button
          type="button"
          className={`tab-btn${activeTab === "joined" ? " active" : ""}`}
          onClick={() => setActiveTab("joined")}
        >
          Joined ({data.joined_events.length})
        </button>
      </div>

      {activeEvents.length === 0 ? (
        <p style={{ color: "#6b7280" }}>
          {activeTab === "created" ? "You haven't created any events yet." : "You haven't joined any events yet."}
        </p>
      ) : (
        <ul className="event-list">
          {activeEvents.map((event) =>
            activeTab === "created" ? (
              <EventCard
                key={event.id}
                event={event}
                actionLabel="Delete"
                actionClass="btn-danger"
                onAction={deleteEvent}
                busy={busyEventId === event.id}
              />
            ) : (
              <EventCard
                key={event.id}
                event={event}
                actionLabel="Leave"
                actionClass="btn-secondary"
                onAction={leaveEvent}
                busy={busyEventId === event.id}
              />
            )
          )}
        </ul>
      )}
    </section>
  );
}
