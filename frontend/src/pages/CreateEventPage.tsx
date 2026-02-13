import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ApiError, apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { EventCreatePayload } from "../types";

export function CreateEventPage() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [sportType, setSportType] = useState("");
  const [description, setDescription] = useState("");
  const [locationText, setLocationText] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) {
      return;
    }

    const payload: EventCreatePayload = {
      title,
      location_text: locationText,
      start_time: new Date(startTime).toISOString(),
      end_time: new Date(endTime).toISOString(),
    };

    if (sportType.trim()) payload.sport_type = sportType.trim();
    if (description.trim()) payload.description = description.trim();
    if (latitude.trim()) payload.latitude = Number(latitude);
    if (longitude.trim()) payload.longitude = Number(longitude);
    if (maxParticipants.trim()) payload.max_participants = Number(maxParticipants);

    try {
      const created = await apiClient.createEvent(payload, token);
      navigate(`/events/${created.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create event");
    }
  }

  return (
    <section className="panel">
      <h1>Create Event</h1>
      <form className="form" onSubmit={onSubmit}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" required />
        <input value={sportType} onChange={(e) => setSportType(e.target.value)} placeholder="Sport type (optional)" />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" />
        <input
          value={locationText}
          onChange={(e) => setLocationText(e.target.value)}
          placeholder="Location"
          required
        />
        <label>
          Start time
          <input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        </label>
        <label>
          End time
          <input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
        </label>
        <input value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="Latitude (optional)" />
        <input value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="Longitude (optional)" />
        <input
          value={maxParticipants}
          onChange={(e) => setMaxParticipants(e.target.value)}
          placeholder="Max participants (optional)"
        />
        <button type="submit">Create</button>
        {error ? <p className="error">{error}</p> : null}
      </form>
    </section>
  );
}
