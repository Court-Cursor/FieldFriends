import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { EventItem } from "../types";
import { EventListPage } from "./EventListPage";

vi.mock("../auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../api/client", () => ({
  apiClient: {
    listEvents: vi.fn(),
    getEvent: vi.fn(),
    joinEvent: vi.fn(),
    leaveEvent: vi.fn(),
    deleteEvent: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

const mockUseAuth = vi.mocked(useAuth);
const mockListEvents = vi.mocked(apiClient.listEvents);
const mockJoinEvent = vi.mocked(apiClient.joinEvent);
const mockGetEvent = vi.mocked(apiClient.getEvent);

const baseAuth = {
  token: null as string | null,
  user: null,
  loading: false,
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
};

function makeEvent(overrides: Partial<EventItem> = {}): EventItem {
  return {
    id: "evt1",
    creator_id: "u1",
    title: "Football Match",
    sport_type: "Football",
    description: null,
    start_time: "2025-06-01T10:00:00Z",
    end_time: "2025-06-01T12:00:00Z",
    location_text: "Central Park",
    latitude: null,
    longitude: null,
    max_participants: null,
    created_at: "",
    joined_count: 0,
    is_joined_by_me: null,
    ...overrides,
  };
}

describe("EventListPage", () => {
  beforeEach(() => vi.clearAllMocks());

  test("renders event list after loading", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockListEvents.mockResolvedValue([makeEvent()]);

    render(
      <MemoryRouter>
        <EventListPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Football Match")).toBeInTheDocument();
      expect(screen.getByText("Central Park")).toBeInTheDocument();
    });
  });

  test("shows empty state when no events are returned", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockListEvents.mockResolvedValue([]);

    render(
      <MemoryRouter>
        <EventListPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("No upcoming events found.")).toBeInTheDocument();
    });
  });

  test("shows error message when event loading fails", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockListEvents.mockRejectedValue(new Error("Network error"));

    render(
      <MemoryRouter>
        <EventListPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Failed to load events")).toBeInTheDocument();
    });
  });

  test("shows Join button for unjoined event when logged in as non-creator", async () => {
    const user = { id: "u2", email: "alice@example.com", created_at: "" };
    mockUseAuth.mockReturnValue({ ...baseAuth, token: "tok", user });
    mockListEvents.mockResolvedValue([makeEvent({ is_joined_by_me: false })]);

    render(
      <MemoryRouter>
        <EventListPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Join Event" })).toBeInTheDocument();
    });
  });

  test("shows Leave button for already-joined event", async () => {
    const user = { id: "u2", email: "alice@example.com", created_at: "" };
    mockUseAuth.mockReturnValue({ ...baseAuth, token: "tok", user });
    const event = makeEvent({ is_joined_by_me: true, joined_count: 1 });
    mockListEvents.mockResolvedValue([event]);
    mockGetEvent.mockResolvedValue(event);

    render(
      <MemoryRouter>
        <EventListPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Leave Event" })).toBeInTheDocument();
    });
  });

  test("shows Delete button when logged in as event creator", async () => {
    const user = { id: "u1", email: "alice@example.com", created_at: "" };
    mockUseAuth.mockReturnValue({ ...baseAuth, token: "tok", user });
    mockListEvents.mockResolvedValue([makeEvent({ creator_id: "u1", is_joined_by_me: false })]);

    render(
      <MemoryRouter>
        <EventListPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Delete Event" })).toBeInTheDocument();
    });
  });

  test("hides action buttons when logged out", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockListEvents.mockResolvedValue([makeEvent()]);

    render(
      <MemoryRouter>
        <EventListPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Football Match")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /join|leave|delete/i })).not.toBeInTheDocument();
  });

  test("calls joinEvent and refreshes list on Join click", async () => {
    const user = { id: "u2", email: "alice@example.com", created_at: "" };
    mockUseAuth.mockReturnValue({ ...baseAuth, token: "tok", user });
    const event = makeEvent({ is_joined_by_me: false });
    const updatedEvent = makeEvent({ is_joined_by_me: true, joined_count: 1 });
    mockListEvents.mockResolvedValue([event]);
    mockJoinEvent.mockResolvedValue(updatedEvent);
    mockGetEvent.mockResolvedValue(updatedEvent);

    render(
      <MemoryRouter>
        <EventListPage />
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByRole("button", { name: "Join Event" }));
    await userEvent.click(screen.getByRole("button", { name: "Join Event" }));

    await waitFor(() => {
      expect(mockJoinEvent).toHaveBeenCalledWith("evt1", "tok");
      expect(mockGetEvent).toHaveBeenCalledWith("evt1", "tok");
    });
  });
});
