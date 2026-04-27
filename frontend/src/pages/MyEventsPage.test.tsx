import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ApiError, apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { EventItem } from "../types";
import { MyEventsPage } from "./MyEventsPage";

vi.mock("../auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../api/client", () => ({
  apiClient: {
    myEvents: vi.fn(),
    deleteEvent: vi.fn(),
    leaveEvent: vi.fn(),
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
const mockMyEvents = vi.mocked(apiClient.myEvents);
const mockDeleteEvent = vi.mocked(apiClient.deleteEvent);
const mockLeaveEvent = vi.mocked(apiClient.leaveEvent);

const baseAuth = {
  token: "tok",
  user: { id: "u1", email: "alice@example.com", created_at: "" },
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
    joined_count: 2,
    is_joined_by_me: null,
    ...overrides,
  };
}

const emptyResponse = { created_events: [], joined_events: [] };

describe("MyEventsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  test("shows loading state initially", () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockMyEvents.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <MyEventsPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  test("renders Created tab by default with events", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockMyEvents.mockResolvedValue({
      created_events: [makeEvent({ title: "My Football Game" })],
      joined_events: [],
    });

    render(
      <MemoryRouter>
        <MyEventsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("My Football Game")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /created/i })).toBeInTheDocument();
  });

  test("shows empty state when no created events", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockMyEvents.mockResolvedValue(emptyResponse);

    render(
      <MemoryRouter>
        <MyEventsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("You haven't created any events yet.")).toBeInTheDocument();
    });
  });

  test("switches to Joined tab and shows joined events", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockMyEvents.mockResolvedValue({
      created_events: [],
      joined_events: [makeEvent({ id: "evt2", title: "Basketball Game", creator_id: "u2" })],
    });

    render(
      <MemoryRouter>
        <MyEventsPage />
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByRole("button", { name: /joined/i }));
    await userEvent.click(screen.getByRole("button", { name: /joined/i }));

    await waitFor(() => {
      expect(screen.getByText("Basketball Game")).toBeInTheDocument();
    });
  });

  test("shows empty state when no joined events", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockMyEvents.mockResolvedValue(emptyResponse);

    render(
      <MemoryRouter>
        <MyEventsPage />
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByRole("button", { name: /joined/i }));
    await userEvent.click(screen.getByRole("button", { name: /joined/i }));

    await waitFor(() => {
      expect(screen.getByText("You haven't joined any events yet.")).toBeInTheDocument();
    });
  });

  test("calls deleteEvent and refreshes on Delete click", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockMyEvents.mockResolvedValue({
      created_events: [makeEvent()],
      joined_events: [],
    });
    mockDeleteEvent.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <MyEventsPage />
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(mockDeleteEvent).toHaveBeenCalledWith("evt1", "tok");
      expect(mockMyEvents).toHaveBeenCalledTimes(2);
    });
  });

  test("calls leaveEvent and refreshes on Leave click", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockMyEvents.mockResolvedValue({
      created_events: [],
      joined_events: [makeEvent({ id: "evt2", creator_id: "u2" })],
    });
    mockLeaveEvent.mockResolvedValue(makeEvent({ id: "evt2", joined_count: 1 }));

    render(
      <MemoryRouter>
        <MyEventsPage />
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByRole("button", { name: /joined/i }));
    await userEvent.click(screen.getByRole("button", { name: /joined/i }));

    await waitFor(() => screen.getByRole("button", { name: "Leave" }));
    await userEvent.click(screen.getByRole("button", { name: "Leave" }));

    await waitFor(() => {
      expect(mockLeaveEvent).toHaveBeenCalledWith("evt2", "tok");
      expect(mockMyEvents).toHaveBeenCalledTimes(2);
    });
  });

  test("shows error message when loading fails", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockMyEvents.mockRejectedValue(new ApiError(500, "Server error"));

    render(
      <MemoryRouter>
        <MyEventsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Server error")).toBeInTheDocument();
    });
  });

  test("does not fetch events when token is null", () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, token: null, user: null });

    render(
      <MemoryRouter>
        <MyEventsPage />
      </MemoryRouter>,
    );

    expect(mockMyEvents).not.toHaveBeenCalled();
  });

  test("shows error when deleteEvent fails", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockMyEvents.mockResolvedValue({
      created_events: [makeEvent()],
      joined_events: [],
    });
    mockDeleteEvent.mockRejectedValue(new ApiError(403, "Cannot delete event"));

    render(
      <MemoryRouter>
        <MyEventsPage />
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => {
      expect(screen.getByText("Cannot delete event")).toBeInTheDocument();
    });
  });

  test("shows error when leaveEvent fails", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockMyEvents.mockResolvedValue({
      created_events: [],
      joined_events: [makeEvent({ id: "evt2", creator_id: "u2" })],
    });
    mockLeaveEvent.mockRejectedValue(new ApiError(500, "Cannot leave event"));

    render(
      <MemoryRouter>
        <MyEventsPage />
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByRole("button", { name: /joined/i }));
    await userEvent.click(screen.getByRole("button", { name: /joined/i }));

    await waitFor(() => screen.getByRole("button", { name: "Leave" }));
    await userEvent.click(screen.getByRole("button", { name: "Leave" }));

    await waitFor(() => {
      expect(screen.getByText("Cannot leave event")).toBeInTheDocument();
    });
  });

  test("shows tab counts correctly", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockMyEvents.mockResolvedValue({
      created_events: [makeEvent(), makeEvent({ id: "evt2", title: "Tennis" })],
      joined_events: [makeEvent({ id: "evt3", title: "Swimming", creator_id: "u2" })],
    });

    render(
      <MemoryRouter>
        <MyEventsPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Created (2)" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Joined (1)" })).toBeInTheDocument();
    });
  });
});
