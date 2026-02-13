import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { ApiError, apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { EventItem } from "../types";

export function EventListPage() {
  const { token } = useAuth();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .listEvents(token ?? undefined)
      .then(setEvents)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load events"))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return <p>Loading events...</p>;
  }

  if (error) {
    return <p className="error">{error}</p>;
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
          </li>
        ))}
      </ul>
    </section>
  );
}
