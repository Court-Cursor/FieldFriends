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

  function lastRequest() {
    return vi.mocked(fetch).mock.calls.at(-1) as [string, RequestInit];
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

  test("uses response statusText when error body is not JSON", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response("plain failure", { status: 500, statusText: "Server Error" }),
    );

    await expect(apiClient.listEvents()).rejects.toMatchObject({
      status: 500,
      message: "Server Error",
    });
  });

  test("returns null on empty successful response body", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response("", { status: 200 }));

    await expect(apiClient.listEvents()).resolves.toBeNull();
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

    const [, init] = lastRequest();
    const headers = init.headers as Headers;
    expect(headers.get("Authorization")).toBeNull();
  });

  test("getEvent sends GET with optional auth", async () => {
    mockOk({ id: "evt1" });

    await apiClient.getEvent("evt1", "tok");

    const [url, init] = lastRequest();
    const headers = init.headers as Headers;
    expect(url).toContain("/events/evt1");
    expect(headers.get("Authorization")).toBe("Bearer tok");
  });

  test("createEvent sends POST payload with auth", async () => {
    const payload = {
      title: "Park Run",
      start_time: "2025-07-01T08:00:00.000Z",
      end_time: "2025-07-01T09:00:00.000Z",
      location_text: "Botanic Gardens",
    };
    mockOk({ id: "evt-new" });

    await apiClient.createEvent(payload, "tok");

    const [url, init] = lastRequest();
    const headers = init.headers as Headers;
    expect(url).toContain("/events");
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify(payload));
    expect(headers.get("Authorization")).toBe("Bearer tok");
  });

  test("joinEvent sends POST with auth", async () => {
    mockOk({ id: "evt1", is_joined_by_me: true });

    await apiClient.joinEvent("evt1", "tok");

    const [url, init] = lastRequest();
    const headers = init.headers as Headers;
    expect(url).toContain("/events/evt1/join");
    expect(init.method).toBe("POST");
    expect(headers.get("Authorization")).toBe("Bearer tok");
  });

  test("leaveEvent sends DELETE with auth", async () => {
    mockOk({ id: "evt1", is_joined_by_me: false });

    await apiClient.leaveEvent("evt1", "tok");

    const [url, init] = lastRequest();
    const headers = init.headers as Headers;
    expect(url).toContain("/events/evt1/leave");
    expect(init.method).toBe("DELETE");
    expect(headers.get("Authorization")).toBe("Bearer tok");
  });

  test("removeParticipant sends DELETE with auth", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));

    await apiClient.removeParticipant("evt1", "u2", "tok");

    const [url, init] = lastRequest();
    const headers = init.headers as Headers;
    expect(url).toContain("/events/evt1/participants/u2");
    expect(init.method).toBe("DELETE");
    expect(headers.get("Authorization")).toBe("Bearer tok");
  });

  test("myEvents attaches Authorization header", async () => {
    mockOk({ created_events: [], joined_events: [] });

    await apiClient.myEvents("tok");

    const [url, init] = lastRequest();
    const headers = init.headers as Headers;
    expect(url).toContain("/users/me/events");
    expect(headers.get("Authorization")).toBe("Bearer tok");
  });
});
