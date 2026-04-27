import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ApiError, apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { EventItem } from "../types";
import { EventDetailPage } from "./EventDetailPage";

const mockNavigate = vi.fn();

vi.mock("../auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../api/client", () => ({
  apiClient: {
    getEvent: vi.fn(),
    joinEvent: vi.fn(),
    leaveEvent: vi.fn(),
    deleteEvent: vi.fn(),
    removeParticipant: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ eventId: "evt1" }),
  };
});

const mockUseAuth = vi.mocked(useAuth);
const mockGetEvent = vi.mocked(apiClient.getEvent);
const mockJoinEvent = vi.mocked(apiClient.joinEvent);
const mockLeaveEvent = vi.mocked(apiClient.leaveEvent);
const mockDeleteEvent = vi.mocked(apiClient.deleteEvent);
const mockRemoveParticipant = vi.mocked(apiClient.removeParticipant);

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
    description: "Casual game at the park",
    start_time: "2025-06-01T10:00:00Z",
    end_time: "2025-06-01T12:00:00Z",
    location_text: "Central Park",
    latitude: null,
    longitude: null,
    max_participants: null,
    created_at: "",
    joined_count: 2,
    is_joined_by_me: null,
    participants: [],
    ...overrides,
  };
}

describe("EventDetailPage", () => {
  beforeEach(() => vi.clearAllMocks());

  test("renders event details after loading", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockGetEvent.mockResolvedValue(makeEvent());

    render(
      <MemoryRouter>
        <EventDetailPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Football Match")).toBeInTheDocument();
      expect(screen.getByText("Casual game at the park")).toBeInTheDocument();
      expect(screen.getByText("Central Park")).toBeInTheDocument();
      expect(screen.getByText("2 joined")).toBeInTheDocument();
    });
  });

  test("shows loading state initially", () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockGetEvent.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <EventDetailPage />
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading event...")).toBeInTheDocument();
  });

  test("shows error message when loading fails", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockGetEvent.mockRejectedValue(new ApiError(404, "Event not found"));

    render(
      <MemoryRouter>
        <EventDetailPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Event not found")).toBeInTheDocument();
    });
  });

  test("shows login prompt for unauthenticated user", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockGetEvent.mockResolvedValue(makeEvent());

    render(
      <MemoryRouter>
        <EventDetailPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/log in/i)).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /join|leave|delete/i })).not.toBeInTheDocument();
  });

  test("shows Join button for non-creator non-joined user", async () => {
    const user = { id: "u2", email: "alice@example.com", created_at: "" };
    mockUseAuth.mockReturnValue({ ...baseAuth, token: "tok", user });
    mockGetEvent.mockResolvedValue(makeEvent({ is_joined_by_me: false }));

    render(
      <MemoryRouter>
        <EventDetailPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Join Event" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Leave Event" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Event" })).not.toBeInTheDocument();
  });

  test("shows Leave button for joined non-creator", async () => {
    const user = { id: "u2", email: "alice@example.com", created_at: "" };
    mockUseAuth.mockReturnValue({ ...baseAuth, token: "tok", user });
    mockGetEvent.mockResolvedValue(makeEvent({ is_joined_by_me: true }));

    render(
      <MemoryRouter>
        <EventDetailPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Leave Event" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Join Event" })).not.toBeInTheDocument();
  });

  test("shows Delete button for event creator", async () => {
    const user = { id: "u1", email: "creator@example.com", created_at: "" };
    mockUseAuth.mockReturnValue({ ...baseAuth, token: "tok", user });
    mockGetEvent.mockResolvedValue(makeEvent({ creator_id: "u1" }));

    render(
      <MemoryRouter>
        <EventDetailPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Delete Event" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "Join Event" })).not.toBeInTheDocument();
  });

  test("calls joinEvent and updates event on Join click", async () => {
    const user = { id: "u2", email: "alice@example.com", created_at: "" };
    mockUseAuth.mockReturnValue({ ...baseAuth, token: "tok", user });
    const updated = makeEvent({ is_joined_by_me: true, joined_count: 3 });
    mockGetEvent.mockResolvedValue(makeEvent({ is_joined_by_me: false }));
    mockJoinEvent.mockResolvedValue(updated);

    render(
      <MemoryRouter>
        <EventDetailPage />
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByRole("button", { name: "Join Event" }));
    await userEvent.click(screen.getByRole("button", { name: "Join Event" }));

    await waitFor(() => {
      expect(mockJoinEvent).toHaveBeenCalledWith("evt1", "tok");
    });
  });

  test("calls leaveEvent on Leave click", async () => {
    const user = { id: "u2", email: "alice@example.com", created_at: "" };
    mockUseAuth.mockReturnValue({ ...baseAuth, token: "tok", user });
    const updated = makeEvent({ is_joined_by_me: false, joined_count: 1 });
    mockGetEvent.mockResolvedValue(makeEvent({ is_joined_by_me: true }));
    mockLeaveEvent.mockResolvedValue(updated);

    render(
      <MemoryRouter>
        <EventDetailPage />
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByRole("button", { name: "Leave Event" }));
    await userEvent.click(screen.getByRole("button", { name: "Leave Event" }));

    await waitFor(() => {
      expect(mockLeaveEvent).toHaveBeenCalledWith("evt1", "tok");
    });
  });

  test("calls deleteEvent and navigates away on Delete click", async () => {
    const user = { id: "u1", email: "creator@example.com", created_at: "" };
    mockUseAuth.mockReturnValue({ ...baseAuth, token: "tok", user });
    mockGetEvent.mockResolvedValue(makeEvent({ creator_id: "u1" }));
    mockDeleteEvent.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <EventDetailPage />
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByRole("button", { name: "Delete Event" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete Event" }));

    await waitFor(() => {
      expect(mockDeleteEvent).toHaveBeenCalledWith("evt1", "tok");
      expect(mockNavigate).toHaveBeenCalledWith("/events");
    });
  });

  test("shows participants list when available", async () => {
    const user = { id: "u2", email: "alice@example.com", created_at: "" };
    mockUseAuth.mockReturnValue({ ...baseAuth, token: "tok", user });
    mockGetEvent.mockResolvedValue(
      makeEvent({
        is_joined_by_me: true,
        participants: [
          { user_id: "u3", email: "bob@example.com", joined_at: "2025-06-01T09:00:00Z" },
        ],
      }),
    );

    render(
      <MemoryRouter>
        <EventDetailPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    });
  });

  test("shows Remove button for creator next to other participants", async () => {
    const user = { id: "u1", email: "creator@example.com", created_at: "" };
    mockUseAuth.mockReturnValue({ ...baseAuth, token: "tok", user });
    mockGetEvent.mockResolvedValue(
      makeEvent({
        creator_id: "u1",
        participants: [
          { user_id: "u3", email: "bob@example.com", joined_at: "2025-06-01T09:00:00Z" },
        ],
      }),
    );

    render(
      <MemoryRouter>
        <EventDetailPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();
    });
  });

  test("calls removeParticipant and refreshes on Remove click", async () => {
    const user = { id: "u1", email: "creator@example.com", created_at: "" };
    mockUseAuth.mockReturnValue({ ...baseAuth, token: "tok", user });
    const eventWithParticipant = makeEvent({
      creator_id: "u1",
      participants: [
        { user_id: "u3", email: "bob@example.com", joined_at: "2025-06-01T09:00:00Z" },
      ],
    });
    mockGetEvent.mockResolvedValue(eventWithParticipant);
    mockRemoveParticipant.mockResolvedValue(undefined);

    render(
      <MemoryRouter>
        <EventDetailPage />
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByRole("button", { name: "Remove" }));
    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(mockRemoveParticipant).toHaveBeenCalledWith("evt1", "u3", "tok");
    });
  });

  test("renders event without optional sport_type and description", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockGetEvent.mockResolvedValue(makeEvent({ sport_type: null, description: null }));

    render(
      <MemoryRouter>
        <EventDetailPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("Football Match")).toBeInTheDocument();
    });
    expect(screen.queryByText("Football")).not.toBeInTheDocument();
    expect(screen.queryByText("Casual game at the park")).not.toBeInTheDocument();
  });

  test("shows inline error when joinEvent fails after event loads", async () => {
    const user = { id: "u2", email: "alice@example.com", created_at: "" };
    mockUseAuth.mockReturnValue({ ...baseAuth, token: "tok", user });
    mockGetEvent.mockResolvedValue(makeEvent({ is_joined_by_me: false }));
    mockJoinEvent.mockRejectedValue(new ApiError(409, "Already joined"));

    render(
      <MemoryRouter>
        <EventDetailPage />
      </MemoryRouter>,
    );

    await waitFor(() => screen.getByRole("button", { name: "Join Event" }));
    await userEvent.click(screen.getByRole("button", { name: "Join Event" }));

    await waitFor(() => {
      expect(screen.getByText("Already joined")).toBeInTheDocument();
    });
  });

  test("does not show Remove button next to the creator's own participant entry", async () => {
    const user = { id: "u1", email: "creator@example.com", created_at: "" };
    mockUseAuth.mockReturnValue({ ...baseAuth, token: "tok", user });
    mockGetEvent.mockResolvedValue(
      makeEvent({
        creator_id: "u1",
        participants: [
          { user_id: "u1", email: "creator@example.com", joined_at: "2025-06-01T09:00:00Z" },
          { user_id: "u3", email: "bob@example.com", joined_at: "2025-06-01T09:05:00Z" },
        ],
      }),
    );

    render(
      <MemoryRouter>
        <EventDetailPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText("creator@example.com")).toBeInTheDocument();
      expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    });
    // Only one Remove button (for bob, not for the creator themselves)
    expect(screen.getAllByRole("button", { name: "Remove" })).toHaveLength(1);
  });
});
