import { NextRequest } from "next/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

import type { Principal } from "@/lib/auth/session";
import type { UserRole } from "@/generated/prisma/enums";

/**
 * Route-handler behaviour: authentication, authorisation, validation, the
 * response envelope and error mapping.
 *
 * The session lookup is the only thing stubbed — everything else (the
 * `defineRoute` wrapper, the permission layer, the services and the database)
 * is the real implementation, so these exercise the actual request path.
 *
 * Run with: RUN_INTEGRATION_TESTS=1 npm test
 */

/** Set by each test to control who the request is from. */
let currentPrincipal: Principal | null = null;

vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth/session")>();
  return {
    ...actual,
    getPrincipalFromRequest: async () => currentPrincipal,
    getPrincipal: async () => currentPrincipal,
  };
});

const { prisma } = await import("@/lib/db/prisma");
const glucoseRoute = await import("@/app/api/glucose/route");
const glucoseItemRoute = await import("@/app/api/glucose/[id]/route");
const meRoute = await import("@/app/api/users/me/route");
const adminParticipantsRoute = await import("@/app/api/admin/participants/route");

const BASE = "http://localhost:3000";

function principal(overrides: Partial<Principal> & { userId: string; role: UserRole }): Principal {
  return {
    email: "test@example.com",
    name: "Test User",
    status: "ACTIVE",
    emailVerified: true,
    timezone: "UTC",
    sessionId: "test-session",
    ...overrides,
  };
}

function get(path: string, headers: Record<string, string> = {}) {
  return new NextRequest(`${BASE}${path}`, { method: "GET", headers });
}

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: BASE, ...headers },
    body: JSON.stringify(body),
  });
}

const noParams = { params: Promise.resolve({}) };
const withParams = (params: Record<string, string>) => ({ params: Promise.resolve(params) });

let patientA: Principal;
let patientB: Principal;
let admin: Principal;
/** A glucose reading belonging to patientB. */
let patientBReadingId: string;

beforeAll(async () => {
  const patients = await prisma.user.findMany({
    where: { role: "PATIENT" },
    take: 2,
    select: { id: true, email: true, name: true },
  });
  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true, email: true, name: true },
  });

  if (patients.length < 2 || !adminUser) {
    throw new Error("Seed data is incomplete.");
  }

  patientA = principal({ ...patients[0]!, userId: patients[0]!.id, role: "PATIENT" });
  patientB = principal({ ...patients[1]!, userId: patients[1]!.id, role: "PATIENT" });
  admin = principal({ ...adminUser, userId: adminUser.id, role: "ADMIN" });

  const reading = await prisma.glucoseReading.findFirst({
    where: { userId: patientB.userId },
    select: { id: true },
  });
  if (!reading) throw new Error("Seed data has no glucose reading for the second patient.");
  patientBReadingId = reading.id;
});

describe("authentication", () => {
  it("rejects an unauthenticated request with 401", async () => {
    currentPrincipal = null;

    const response = await glucoseRoute.GET(get("/api/glucose"), noParams);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      success: false,
      error: { code: "UNAUTHENTICATED", message: expect.any(String) },
    });
  });

  it("rejects a principal whose email is not verified", async () => {
    currentPrincipal = { ...patientA, emailVerified: false };

    const response = await glucoseRoute.GET(get("/api/glucose"), noParams);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe("FORBIDDEN");
  });

  it("returns the caller's own account from /api/users/me", async () => {
    currentPrincipal = patientA;

    const response = await meRoute.GET(get("/api/users/me"), noParams);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.id).toBe(patientA.userId);
    // The account payload must never carry credentials.
    expect(JSON.stringify(payload)).not.toMatch(/password|passwordHash|token/i);
  });
});

describe("response envelope", () => {
  it("wraps a successful list in the documented shape", async () => {
    currentPrincipal = patientA;

    const response = await glucoseRoute.GET(get("/api/glucose?range=1y"), noParams);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(Array.isArray(payload.data)).toBe(true);
    expect(payload.meta.pagination).toMatchObject({
      page: 1,
      pageSize: 25,
      total: expect.any(Number),
      totalPages: expect.any(Number),
      hasNextPage: expect.any(Boolean),
      hasPreviousPage: false,
    });
  });

  it("never caches a health-data response", async () => {
    currentPrincipal = patientA;

    const response = await glucoseRoute.GET(get("/api/glucose"), noParams);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("returns a request id for correlation", async () => {
    currentPrincipal = patientA;

    const response = await glucoseRoute.GET(get("/api/glucose"), noParams);
    expect(response.headers.get("x-request-id")).toBeTruthy();
  });

  it("returns only the caller's readings", async () => {
    currentPrincipal = patientA;

    const response = await glucoseRoute.GET(get("/api/glucose?range=1y&pageSize=100"), noParams);
    const payload = await response.json();

    const ids: string[] = payload.data.map((row: { id: string }) => row.id);
    expect(ids).not.toContain(patientBReadingId);
  });
});

describe("validation", () => {
  it("rejects an out-of-range query parameter", async () => {
    currentPrincipal = patientA;

    const response = await glucoseRoute.GET(get("/api/glucose?pageSize=99999"), noParams);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(payload.error.issues?.[0]?.field).toBe("pageSize");
  });

  it("rejects a physiologically impossible reading", async () => {
    currentPrincipal = patientA;

    const response = await glucoseRoute.POST(
      post("/api/glucose", {
        value: 9999,
        unit: "MG_DL",
        measuredAt: new Date(Date.now() - 60_000).toISOString(),
      }),
      noParams,
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
  });

  it("reports the offending field without echoing the value", async () => {
    currentPrincipal = patientA;

    const response = await glucoseRoute.POST(
      post("/api/glucose", { value: 9999, measuredAt: new Date().toISOString() }),
      noParams,
    );
    const payload = await response.json();

    expect(payload.error.issues?.some((i: { field: string }) => i.field === "value")).toBe(true);
    expect(JSON.stringify(payload)).not.toContain("9999");
  });

  it("rejects a body that is not JSON", async () => {
    currentPrincipal = patientA;

    const request = new NextRequest(`${BASE}/api/glucose`, {
      method: "POST",
      headers: { "content-type": "text/plain", origin: BASE },
      body: "value=120",
    });

    const response = await glucoseRoute.POST(request, noParams);
    expect(response.status).toBe(400);
  });

  it("accepts and stores a valid reading, then removes it", async () => {
    currentPrincipal = patientA;

    const measuredAt = new Date(Date.now() - 120_000).toISOString();
    const response = await glucoseRoute.POST(
      post("/api/glucose", {
        value: 118,
        unit: "MG_DL",
        context: "FASTING",
        measuredAt,
      }),
      noParams,
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data.value).toBe(118);

    await prisma.glucoseReading.delete({ where: { id: payload.data.id } });
  });
});

describe("CSRF protection", () => {
  it("refuses a cookie-authenticated mutation with no origin", async () => {
    currentPrincipal = patientA;

    const request = new NextRequest(`${BASE}/api/glucose`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: 120, measuredAt: new Date().toISOString() }),
    });

    const response = await glucoseRoute.POST(request, noParams);
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe("FORBIDDEN");
  });

  it("refuses a mutation from an untrusted origin", async () => {
    currentPrincipal = patientA;

    const response = await glucoseRoute.POST(
      post(
        "/api/glucose",
        { value: 120, measuredAt: new Date().toISOString() },
        { origin: "https://evil.example" },
      ),
      noParams,
    );

    expect(response.status).toBe(403);
  });

  it("allows a bearer-token mutation without an origin, since cookies are not involved", async () => {
    currentPrincipal = patientA;

    const request = new NextRequest(`${BASE}/api/glucose`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer stub-token",
      },
      body: JSON.stringify({
        value: 121,
        unit: "MG_DL",
        measuredAt: new Date(Date.now() - 60_000).toISOString(),
      }),
    });

    const response = await glucoseRoute.POST(request, noParams);
    const payload = await response.json();

    expect(response.status).toBe(201);
    await prisma.glucoseReading.delete({ where: { id: payload.data.id } });
  });
});

describe("record-level authorisation", () => {
  it("stops a participant reading another participant's record", async () => {
    currentPrincipal = patientA;

    const response = await glucoseItemRoute.GET(
      get(`/api/glucose/${patientBReadingId}`),
      withParams({ id: patientBReadingId }),
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe("FORBIDDEN");
  });

  it("stops a participant deleting another participant's record", async () => {
    currentPrincipal = patientA;

    const request = new NextRequest(`${BASE}/api/glucose/${patientBReadingId}`, {
      method: "DELETE",
      headers: { origin: BASE },
    });

    const response = await glucoseItemRoute.DELETE(request, withParams({ id: patientBReadingId }));
    expect(response.status).toBe(403);

    // The record must still exist.
    const still = await prisma.glucoseReading.findUnique({
      where: { id: patientBReadingId },
      select: { id: true },
    });
    expect(still).not.toBeNull();
  });

  it("lets the owner read their own record", async () => {
    currentPrincipal = patientB;

    const response = await glucoseItemRoute.GET(
      get(`/api/glucose/${patientBReadingId}`),
      withParams({ id: patientBReadingId }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.id).toBe(patientBReadingId);
    // The owner id is internal and should not be echoed back.
    expect(payload.data.userId).toBeUndefined();
  });

  it("returns 404 for an unknown record", async () => {
    currentPrincipal = patientA;

    const response = await glucoseItemRoute.GET(
      get("/api/glucose/does-not-exist"),
      withParams({ id: "does-not-exist" }),
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe("NOT_FOUND");
  });
});

describe("admin endpoint authorisation", () => {
  it("refuses a participant with 403", async () => {
    currentPrincipal = patientA;

    const response = await adminParticipantsRoute.GET(
      get("/api/admin/participants"),
      noParams,
    );
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error.code).toBe("FORBIDDEN");
  });

  it("refuses an unauthenticated caller with 401", async () => {
    currentPrincipal = null;

    const response = await adminParticipantsRoute.GET(
      get("/api/admin/participants"),
      noParams,
    );
    expect(response.status).toBe(401);
  });

  it("allows an administrator and returns every participant", async () => {
    currentPrincipal = admin;

    const response = await adminParticipantsRoute.GET(
      get("/api/admin/participants?pageSize=100"),
      noParams,
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    const total = await prisma.user.count({ where: { role: "PATIENT" } });
    expect(payload.meta.pagination.total).toBe(total);
  });
});
