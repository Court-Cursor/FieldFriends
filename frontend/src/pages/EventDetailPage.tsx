import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
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
        <div>
          {canJoin ? (
            <button type="button" onClick={joinEvent} disabled={isSubmitting}>
              {isSubmitting ? "Working..." : "Join Event"}
            </button>
          ) : null}
          {canLeave ? (
            <button type="button" onClick={leaveEvent} disabled={isSubmitting}>
              {isSubmitting ? "Working..." : "Leave Event"}
            </button>
          ) : null}
          {isCreator ? (
            <button type="button" onClick={deleteEvent} disabled={isSubmitting}>
              {isSubmitting ? "Working..." : "Delete Event"}
            </button>
          ) : null}
        </div>
      ) : (
        <p>Log in to join this event.</p>
      )}
      <h2>Participants</h2>
      {canSeeParticipants ? (
        event.participants && event.participants.length > 0 ? (
          <ul className="event-list">
            {event.participants.map((participant) => (
              <li key={participant.user_id}>
                <p>{participant.email}</p>
                <p>Joined: {new Date(participant.joined_at).toLocaleString()}</p>
                {isCreator && participant.user_id !== event.creator_id ? (
                  <button
                    type="button"
                    onClick={() => removeParticipant(participant.user_id)}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Working..." : "Remove"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>No participants yet.</p>
        )
      ) : (
        <p>Join this event to view participants.</p>
      )}
      {error ? <p className="error">{error}</p> : null}
    </section>
  );
}
