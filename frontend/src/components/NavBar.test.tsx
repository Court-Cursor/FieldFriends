import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { NavBar } from "./NavBar";

vi.mock("../auth/AuthContext", () => ({ useAuth: vi.fn() }));

const mockUseAuth = vi.mocked(useAuth);

const baseAuth = {
  token: null as string | null,
  loading: false,
  login: vi.fn(),
  signup: vi.fn(),
  logout: vi.fn(),
};

function renderNavBar() {
  return render(
    <MemoryRouter>
      <NavBar />
    </MemoryRouter>,
  );
}

describe("NavBar", () => {
  beforeEach(() => vi.clearAllMocks());

  test("shows Login and Signup links when logged out", () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, user: null });
    renderNavBar();

    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.getByText("Signup")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Logout" })).not.toBeInTheDocument();
  });

  test("hides Create Event and My Events links when logged out", () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, user: null });
    renderNavBar();

    expect(screen.queryByText("Create Event")).not.toBeInTheDocument();
    expect(screen.queryByText("My Events")).not.toBeInTheDocument();
  });

  test("shows user email and Logout button when logged in", () => {
    const user = { id: "u1", email: "alice@example.com", created_at: "" };
    mockUseAuth.mockReturnValue({ ...baseAuth, token: "tok", user });
    renderNavBar();

    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Logout" })).toBeInTheDocument();
    expect(screen.queryByText("Login")).not.toBeInTheDocument();
    expect(screen.queryByText("Signup")).not.toBeInTheDocument();
  });

  test("shows Create Event and My Events links when logged in", () => {
    const user = { id: "u1", email: "alice@example.com", created_at: "" };
    mockUseAuth.mockReturnValue({ ...baseAuth, token: "tok", user });
    renderNavBar();

    expect(screen.getByText("Create Event")).toBeInTheDocument();
    expect(screen.getByText("My Events")).toBeInTheDocument();
  });

  test("calls logout when Logout button is clicked", async () => {
    const logout = vi.fn();
    const user = { id: "u1", email: "alice@example.com", created_at: "" };
    mockUseAuth.mockReturnValue({ ...baseAuth, token: "tok", user, logout });
    renderNavBar();

    await userEvent.click(screen.getByRole("button", { name: "Logout" }));

    expect(logout).toHaveBeenCalledOnce();
  });
});
