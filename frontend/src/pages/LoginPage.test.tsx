import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { LoginPage } from "./LoginPage";

const mockNavigate = vi.fn();

vi.mock("../auth/AuthContext", () => ({ useAuth: vi.fn() }));

vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router-dom")>();
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockUseAuth = vi.mocked(useAuth);

const baseAuth = {
  token: null as string | null,
  user: null,
  loading: false,
  signup: vi.fn(),
  logout: vi.fn(),
};

describe("LoginPage", () => {
  beforeEach(() => vi.clearAllMocks());

  test("renders email and password inputs with login button", () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, login: vi.fn() });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument();
  });

  test("calls login with credentials and navigates to / on success", async () => {
    const login = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ ...baseAuth, login });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByPlaceholderText("Email"), "alice@example.com");
    await userEvent.type(screen.getByPlaceholderText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(login).toHaveBeenCalledWith("alice@example.com", "password123");
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  test("shows ApiError message when login fails with known error", async () => {
    const login = vi
      .fn()
      .mockRejectedValue(new ApiError(401, "Invalid credentials"));
    mockUseAuth.mockReturnValue({ ...baseAuth, login });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByPlaceholderText("Email"), "alice@example.com");
    await userEvent.type(screen.getByPlaceholderText("Password"), "wrongpass");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("shows generic message when login throws unknown error", async () => {
    const login = vi.fn().mockRejectedValue(new Error("Network failure"));
    mockUseAuth.mockReturnValue({ ...baseAuth, login });
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByPlaceholderText("Email"), "alice@example.com");
    await userEvent.type(screen.getByPlaceholderText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Log in" }));

    await waitFor(() => {
      expect(screen.getByText("Login failed")).toBeInTheDocument();
    });
  });
});
