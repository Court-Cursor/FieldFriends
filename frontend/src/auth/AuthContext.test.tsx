import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { apiClient } from "../api/client";
import type { AuthResponse, UserSummary } from "../types";
import { AuthProvider, useAuth } from "./AuthContext";

vi.mock("../api/client", () => ({
  apiClient: {
    me: vi.fn(),
    login: vi.fn(),
    signup: vi.fn(),
  },
}));

const mockMe = vi.mocked(apiClient.me);
const mockLogin = vi.mocked(apiClient.login);
const mockSignup = vi.mocked(apiClient.signup);

const user: UserSummary = {
  id: "u1",
  email: "alice@example.com",
  created_at: "2025-01-01T00:00:00Z",
};

function authResponse(token: string, responseUser: UserSummary = user): AuthResponse {
  return {
    access_token: token,
    token_type: "bearer",
    user: responseUser,
  };
}

function AuthHarness() {
  const { token, user: currentUser, loading, login, signup, logout } = useAuth();

  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="token">{token ?? "none"}</span>
      <span data-testid="email">{currentUser?.email ?? "none"}</span>
      <button type="button" onClick={() => void login("alice@example.com", "password123")}>
        Login
      </button>
      <button type="button" onClick={() => void signup("alice@example.com", "password123")}>
        Signup
      </button>
      <button type="button" onClick={logout}>
        Logout
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <AuthHarness />
    </AuthProvider>,
  );
}

describe("AuthProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  test("loads stored token and current user profile", async () => {
    localStorage.setItem("fieldfriends_token", "stored-token");
    mockMe.mockResolvedValue(user);

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
      expect(screen.getByTestId("email")).toHaveTextContent("alice@example.com");
    });
    expect(screen.getByTestId("token")).toHaveTextContent("stored-token");
    expect(mockMe).toHaveBeenCalledWith("stored-token");
  });

  test("clears invalid stored token when profile loading fails", async () => {
    localStorage.setItem("fieldfriends_token", "bad-token");
    mockMe.mockRejectedValue(new Error("Invalid token"));

    renderProvider();

    await waitFor(() => {
      expect(screen.getByTestId("loading")).toHaveTextContent("false");
      expect(screen.getByTestId("token")).toHaveTextContent("none");
      expect(screen.getByTestId("email")).toHaveTextContent("none");
    });
    expect(localStorage.getItem("fieldfriends_token")).toBeNull();
  });

  test("login stores token and user", async () => {
    mockLogin.mockResolvedValue(authResponse("login-token"));
    mockMe.mockResolvedValue(user);

    renderProvider();
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByTestId("token")).toHaveTextContent("login-token");
      expect(screen.getByTestId("email")).toHaveTextContent("alice@example.com");
    });
    expect(localStorage.getItem("fieldfriends_token")).toBe("login-token");
    expect(mockLogin).toHaveBeenCalledWith("alice@example.com", "password123");
  });

  test("signup stores token and user", async () => {
    mockSignup.mockResolvedValue(authResponse("signup-token"));
    mockMe.mockResolvedValue(user);

    renderProvider();
    await userEvent.click(screen.getByRole("button", { name: "Signup" }));

    await waitFor(() => {
      expect(screen.getByTestId("token")).toHaveTextContent("signup-token");
      expect(screen.getByTestId("email")).toHaveTextContent("alice@example.com");
    });
    expect(localStorage.getItem("fieldfriends_token")).toBe("signup-token");
    expect(mockSignup).toHaveBeenCalledWith("alice@example.com", "password123");
  });

  test("logout clears token, user, and storage", async () => {
    localStorage.setItem("fieldfriends_token", "stored-token");
    mockMe.mockResolvedValue(user);

    renderProvider();
    await waitFor(() => expect(screen.getByTestId("email")).toHaveTextContent("alice@example.com"));
    await userEvent.click(screen.getByRole("button", { name: "Logout" }));

    await waitFor(() => {
      expect(screen.getByTestId("token")).toHaveTextContent("none");
      expect(screen.getByTestId("email")).toHaveTextContent("none");
    });
    expect(localStorage.getItem("fieldfriends_token")).toBeNull();
  });
});

describe("useAuth", () => {
  test("throws outside AuthProvider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    function OutsideProvider() {
      useAuth();
      return <div>unreachable</div>;
    }

    expect(() => render(<OutsideProvider />)).toThrow("useAuth must be used within AuthProvider");
    consoleError.mockRestore();
  });
});
