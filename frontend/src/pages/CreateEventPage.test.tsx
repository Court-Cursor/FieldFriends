import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ApiError, apiClient } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { CreateEventPage } from "./CreateEventPage";

const mockNavigate = vi.fn();

vi.mock("../auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("../api/client", () => ({
  apiClient: {
    createEvent: vi.fn(),
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
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockUseAuth = vi.mocked(useAuth);
const mockCreateEvent = vi.mocked(apiClient.createEvent);

const baseAuth = {
  token: "tok",
  user: { id: "u1", email: "alice@example.com", created_at: "" },
  loading: false,
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
};

describe("CreateEventPage", () => {
  beforeEach(() => vi.clearAllMocks());

  test("renders all required form fields and submit button", () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/location/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end time/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Event" })).toBeInTheDocument();
  });

  test("renders optional fields", () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(/sport type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/latitude/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/longitude/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/max participants/i)).toBeInTheDocument();
  });

  test("calls createEvent with correct payload and navigates to new event", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockCreateEvent.mockResolvedValue({
      id: "evt-new",
      creator_id: "u1",
      title: "Park Run",
      sport_type: null,
      description: null,
      start_time: "2025-07-01T08:00:00.000Z",
      end_time: "2025-07-01T09:00:00.000Z",
      location_text: "Botanic Gardens",
      latitude: null,
      longitude: null,
      max_participants: null,
      created_at: "",
      joined_count: 0,
      is_joined_by_me: null,
    });

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText(/title/i), "Park Run");
    await userEvent.type(screen.getByLabelText(/location/i), "Botanic Gardens");
    await userEvent.type(screen.getByLabelText(/start time/i), "2025-07-01T08:00");
    await userEvent.type(screen.getByLabelText(/end time/i), "2025-07-01T09:00");
    await userEvent.click(screen.getByRole("button", { name: "Create Event" }));

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Park Run",
          location_text: "Botanic Gardens",
        }),
        "tok",
      );
      expect(mockNavigate).toHaveBeenCalledWith("/events/evt-new");
    });
  });

  test("shows ApiError message when creation fails", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockCreateEvent.mockRejectedValue(new ApiError(422, "End time must be after start time"));

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText(/title/i), "Park Run");
    await userEvent.type(screen.getByLabelText(/location/i), "Botanic Gardens");
    await userEvent.type(screen.getByLabelText(/start time/i), "2025-07-01T08:00");
    await userEvent.type(screen.getByLabelText(/end time/i), "2025-07-01T07:00");
    await userEvent.click(screen.getByRole("button", { name: "Create Event" }));

    await waitFor(() => {
      expect(screen.getByText("End time must be after start time")).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("does not submit when token is null", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, token: null, user: null });

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText(/title/i), "Park Run");
    await userEvent.type(screen.getByLabelText(/location/i), "Botanic Gardens");
    await userEvent.type(screen.getByLabelText(/start time/i), "2025-07-01T08:00");
    await userEvent.type(screen.getByLabelText(/end time/i), "2025-07-01T09:00");
    await userEvent.click(screen.getByRole("button", { name: "Create Event" }));

    expect(mockCreateEvent).not.toHaveBeenCalled();
  });

  test("includes optional fields in payload when filled", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockCreateEvent.mockResolvedValue({
      id: "evt-new",
      creator_id: "u1",
      title: "Park Run",
      sport_type: "Running",
      description: "Morning run",
      start_time: "2025-07-01T08:00:00.000Z",
      end_time: "2025-07-01T09:00:00.000Z",
      location_text: "Botanic Gardens",
      latitude: 1.3521,
      longitude: 103.8198,
      max_participants: 20,
      created_at: "",
      joined_count: 0,
      is_joined_by_me: null,
    });

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText(/title/i), "Park Run");
    await userEvent.type(screen.getByLabelText(/sport type/i), "Running");
    await userEvent.type(screen.getByLabelText(/description/i), "Morning run");
    await userEvent.type(screen.getByLabelText(/location/i), "Botanic Gardens");
    await userEvent.type(screen.getByLabelText(/start time/i), "2025-07-01T08:00");
    await userEvent.type(screen.getByLabelText(/end time/i), "2025-07-01T09:00");
    await userEvent.type(screen.getByLabelText(/latitude/i), "1.3521");
    await userEvent.type(screen.getByLabelText(/longitude/i), "103.8198");
    await userEvent.type(screen.getByLabelText(/max participants/i), "20");
    await userEvent.click(screen.getByRole("button", { name: "Create Event" }));

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          sport_type: "Running",
          description: "Morning run",
          latitude: 1.3521,
          longitude: 103.8198,
          max_participants: 20,
        }),
        "tok",
      );
    });
  });

  test("shows generic error message on unknown failure", async () => {
    mockUseAuth.mockReturnValue({ ...baseAuth });
    mockCreateEvent.mockRejectedValue(new Error("Network error"));

    render(
      <MemoryRouter>
        <CreateEventPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByLabelText(/title/i), "Park Run");
    await userEvent.type(screen.getByLabelText(/location/i), "Botanic Gardens");
    await userEvent.type(screen.getByLabelText(/start time/i), "2025-07-01T08:00");
    await userEvent.type(screen.getByLabelText(/end time/i), "2025-07-01T09:00");
    await userEvent.click(screen.getByRole("button", { name: "Create Event" }));

    await waitFor(() => {
      expect(screen.getByText("Failed to create event")).toBeInTheDocument();
    });
  });
});
