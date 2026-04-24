import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { SignupPage } from "./SignupPage";

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
  login: vi.fn(),
  logout: vi.fn(),
};

describe("SignupPage", () => {
  beforeEach(() => vi.clearAllMocks());

  test("renders email and password inputs with signup button", () => {
    mockUseAuth.mockReturnValue({ ...baseAuth, signup: vi.fn() });
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    expect(screen.getByPlaceholderText("Email")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Create account" }),
    ).toBeInTheDocument();
  });

  test("calls signup with credentials and navigates to / on success", async () => {
    const signup = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ ...baseAuth, signup });
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByPlaceholderText("Email"), "bob@example.com");
    await userEvent.type(screen.getByPlaceholderText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(signup).toHaveBeenCalledWith("bob@example.com", "password123");
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });
  });

  test("shows ApiError message when signup fails with known error", async () => {
    const signup = vi
      .fn()
      .mockRejectedValue(new ApiError(409, "Email already registered"));
    mockUseAuth.mockReturnValue({ ...baseAuth, signup });
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByPlaceholderText("Email"), "bob@example.com");
    await userEvent.type(screen.getByPlaceholderText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(screen.getByText("Email already registered")).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("shows generic message when signup throws unknown error", async () => {
    const signup = vi.fn().mockRejectedValue(new Error("Network failure"));
    mockUseAuth.mockReturnValue({ ...baseAuth, signup });
    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>,
    );

    await userEvent.type(screen.getByPlaceholderText("Email"), "bob@example.com");
    await userEvent.type(screen.getByPlaceholderText("Password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => {
      expect(screen.getByText("Signup failed")).toBeInTheDocument();
    });
  });
});
