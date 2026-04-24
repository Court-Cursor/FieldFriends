import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";

vi.mock("../auth/AuthContext", () => ({ useAuth: vi.fn() }));

const mockUseAuth = vi.mocked(useAuth);

const baseAuth = {
  token: null as string | null,
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
};

describe("ProtectedRoute", () => {
  beforeEach(() => vi.clearAllMocks());

  test("renders loading indicator while auth is resolving", () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, user: null, loading: true });
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Protected")).not.toBeInTheDocument();
  });

  test("redirects to /login when user is not authenticated", () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, user: null, loading: false });
    render(
      <MemoryRouter initialEntries={["/protected"]}>
        <Routes>
          <Route
            path="/protected"
            element={
              <ProtectedRoute>
                <div>Protected Content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login Page</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  test("renders children when user is authenticated", () => {
    const user = { id: "u1", email: "alice@example.com", created_at: "" };
    mockUseAuth.mockReturnValue({
      ...baseAuth,
      token: "tok",
      user,
      loading: false,
    });
    render(
      <MemoryRouter>
        <ProtectedRoute>
          <div>Protected Content</div>
        </ProtectedRoute>
      </MemoryRouter>,
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });
});
