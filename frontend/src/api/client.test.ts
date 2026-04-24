import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { ApiError, apiClient } from "./client";

describe("ApiError", () => {
  test("stores status and message", () => {
    const err = new ApiError(404, "Not found");
    expect(err.status).toBe(404);
    expect(err.message).toBe("Not found");
    expect(err).toBeInstanceOf(Error);
  });
});

describe("apiClient", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockOk(body: unknown, status = 200) {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status }),
    );
  }

  function mockError(body: unknown, status: number) {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify(body), { status }),
    );
  }

  test("login sends POST to /auth/login and returns token", async () => {
    const payload = {
      access_token: "tok123",
      token_type: "bearer",
      user: { id: "u1", email: "a@b.com", created_at: "" },
    };
    mockOk(payload);

    const result = await apiClient.login("a@b.com", "pass1234");

    expect(result.access_token).toBe("tok123");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/auth/login"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  test("throws ApiError with detail from body on non-ok response", async () => {
    mockError({ detail: "Invalid credentials" }, 401);

    await expect(apiClient.login("a@b.com", "wrong")).rejects.toMatchObject({
      status: 401,
      message: "Invalid credentials",
    });
  });

  test("throws ApiError instance on failure", async () => {
    mockError({ detail: "Unauthorized" }, 401);

    await expect(apiClient.login("a@b.com", "wrong")).rejects.toBeInstanceOf(
      ApiError,
    );
  });

  test("me attaches Authorization header", async () => {
    mockOk({ id: "u1", email: "a@b.com", created_at: "" });

    await apiClient.me("mytoken");

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer mytoken");
  });

  test("signup sends POST to /auth/signup", async () => {
    const payload = {
      access_token: "tok",
      token_type: "bearer",
      user: { id: "u2", email: "b@c.com", created_at: "" },
    };
    mockOk(payload);

    const result = await apiClient.signup("b@c.com", "password123");

    expect(result.access_token).toBe("tok");
    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      expect.stringContaining("/auth/signup"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  test("deleteEvent resolves on 204 No Content", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(apiClient.deleteEvent("evt1", "tok")).resolves.toBeUndefined();
  });

  test("listEvents sends GET without auth when no token", async () => {
    mockOk([]);

    await apiClient.listEvents();

    const [, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBeNull();
  });
});
