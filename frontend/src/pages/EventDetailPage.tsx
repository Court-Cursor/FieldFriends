import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useParams } from "react-router-dom";

import { ApiError, apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { EventItem } from "../types";

export function EventDetailPage() {
  const { eventId } = useParams();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setIsSubmitting(true);
    try {
      const joined = await apiClient.joinEvent(eventId, token);
      setEvent(joined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to join event");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function leaveEvent() {
    if (!eventId || !token) {
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const updated = await apiClient.leaveEvent(eventId, token);
      setEvent(updated);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to leave event");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deleteEvent() {
    if (!eventId || !token) {
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.deleteEvent(eventId, token);
      navigate("/events");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to delete event");
      setIsSubmitting(false);
    }
  }

  async function removeParticipant(userId: string) {
    if (!eventId || !token) {
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await apiClient.removeParticipant(eventId, userId, token);
      const refreshed = await apiClient.getEvent(eventId, token);
      setEvent(refreshed);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to remove participant");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return <p>Loading event...</p>;
  }

  if (!event) {
    return <p>Event not found.</p>;
  }

  const isCreator = Boolean(user && event.creator_id === user.id);
  const isJoined = event.is_joined_by_me === true;
  const canJoin = Boolean(user && !isCreator && !isJoined);
  const canLeave = Boolean(user && !isCreator && isJoined);
  const canSeeParticipants = Array.isArray(event.participants);

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <section className="panel">
      <Link className="back-link" to="/">← Back to events</Link>

      {error ? <p className="error">{error}</p> : null}

      <div className="event-detail-header">
        <h1>{event.title}</h1>
        {event.sport_type ? <span className="sport-badge">{event.sport_type}</span> : null}
      </div>

      {event.description ? (
        <p className="event-description">{event.description}</p>
      ) : null}

      <div className="event-meta-grid">
        <div className="meta-item">
          <span className="meta-label">📍 Location</span>
          <span className="meta-value">{event.location_text}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">🗓 Starts</span>
          <span className="meta-value">{formatDate(event.start_time)}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">🏁 Ends</span>
          <span className="meta-value">{formatDate(event.end_time)}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">👥 Participants</span>
          <span className="meta-value">{event.joined_count} joined</span>
        </div>
      </div>

      {user ? (
        <div className="event-actions">
          {canJoin ? (
            <button type="button" onClick={joinEvent} disabled={isSubmitting}>
              {isSubmitting ? "Working..." : "Join Event"}
            </button>
          ) : null}
          {canLeave ? (
            <button type="button" className="btn-secondary" onClick={leaveEvent} disabled={isSubmitting}>
              {isSubmitting ? "Working..." : "Leave Event"}
            </button>
          ) : null}
          {isCreator ? (
            <button type="button" className="btn-danger" onClick={deleteEvent} disabled={isSubmitting}>
              {isSubmitting ? "Working..." : "Delete Event"}
            </button>
          ) : null}
        </div>
      ) : (
        <p style={{ color: "#6b7280" }}>
          <Link to="/login">Log in</Link> to join this event.
        </p>
      )}

      <h2>Participants</h2>
      {canSeeParticipants ? (
        event.participants && event.participants.length > 0 ? (
          <ul className="event-list">
            {event.participants.map((participant) => (
              <li key={participant.user_id}>
                <div className="participant-row">
                  <div className="participant-info">
                    <span className="participant-email">{participant.email}</span>
                    <span className="participant-joined">Joined {formatDate(participant.joined_at)}</span>
                  </div>
                  {isCreator && participant.user_id !== event.creator_id ? (
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => removeParticipant(participant.user_id)}
                      disabled={isSubmitting}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ color: "#6b7280" }}>No participants yet.</p>
        )
      ) : (
        <p style={{ color: "#6b7280" }}>Join this event to view participants.</p>
      )}
    </section>
  );
}
