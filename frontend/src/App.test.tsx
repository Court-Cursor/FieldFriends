import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { useAuth } from "./auth/AuthContext";
import App from "./App";

vi.mock("./auth/AuthContext", () => ({ useAuth: vi.fn() }));
vi.mock("./pages/EventListPage", () => ({ EventListPage: () => <div>Events Page</div> }));
vi.mock("./pages/EventDetailPage", () => ({ EventDetailPage: () => <div>Event Detail Page</div> }));
vi.mock("./pages/CreateEventPage", () => ({ CreateEventPage: () => <div>Create Event Page</div> }));
vi.mock("./pages/MyEventsPage", () => ({ MyEventsPage: () => <div>My Events Page</div> }));
vi.mock("./pages/LoginPage", () => ({ LoginPage: () => <div>Login Page</div> }));
vi.mock("./pages/SignupPage", () => ({ SignupPage: () => <div>Signup Page</div> }));

const mockUseAuth = vi.mocked(useAuth);
type AuthState = ReturnType<typeof useAuth>;

const loggedOutAuth: AuthState = {
  token: null,
  user: null,
  loading: false,
  login: vi.fn(async () => undefined),
  signup: vi.fn(async () => undefined),
  logout: vi.fn(),
};

const loggedInAuth: AuthState = {
  ...loggedOutAuth,
  token: "tok",
  user: { id: "u1", email: "alice@example.com", created_at: "" },
};

function renderApp(path: string, auth: AuthState = loggedOutAuth) {
  mockUseAuth.mockReturnValue(auth);
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

describe("App routes", () => {
  beforeEach(() => vi.clearAllMocks());

  test.each([
    ["/", "Events Page"],
    ["/login", "Login Page"],
    ["/signup", "Signup Page"],
    ["/events/evt1", "Event Detail Page"],
  ])("renders public route %s", (path, expectedText) => {
    renderApp(path);

    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });

  test("redirects unknown routes to the event list", () => {
    renderApp("/missing-route");

    expect(screen.getByText("Events Page")).toBeInTheDocument();
  });

  test.each([
    ["/events/new", "Create Event Page"],
    ["/my-events", "My Events Page"],
  ])("redirects protected route %s to login when logged out", (path, protectedText) => {
    renderApp(path);

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText(protectedText)).not.toBeInTheDocument();
  });

  test.each([
    ["/events/new", "Create Event Page"],
    ["/my-events", "My Events Page"],
  ])("renders protected route %s when logged in", (path, expectedText) => {
    renderApp(path, loggedInAuth);

    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });
});
