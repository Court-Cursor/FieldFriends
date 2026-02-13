import { useEffect, useState } from "react";

import { ApiError, apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { EventItem, MyEventsResponse } from "../types";

function EventGroup({ title, events }: { title: string; events: EventItem[] }) {
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

  useEffect(() => {
    if (!token) {
      return;
    }

    apiClient
      .myEvents(token)
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load my events"));
  }, [token]);

  if (error) {
    return <p className="error">{error}</p>;
  }

  if (!data) {
    return <p>Loading...</p>;
  }

  return (
    <section className="panel">
      <h1>My Events</h1>
      <EventGroup title="Created" events={data.created_events} />
      <EventGroup title="Joined" events={data.joined_events} />
    </section>
  );
}
