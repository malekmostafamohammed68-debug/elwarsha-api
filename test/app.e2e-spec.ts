import { INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import request from "supertest";

import { hmacSha256 } from "../src/common/crypto.js";
import { HttpExceptionFilter } from "../src/common/http-exception.filter.js";
import { AppModule } from "../src/app.module.js";
import { JobService } from "../src/infrastructure/jobs/job.service.js";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service.js";

process.env.DATABASE_URL ??= "postgresql://elwarsha:elwarsha@localhost:5432/elwarsha";
process.env.WEB_ORIGIN ??= "http://localhost:5173";
process.env.SESSION_SECRET ??= "replace-with-32-byte-secret";
process.env.GITHUB_WEBHOOK_SECRET ??= "replace-webhook-secret";

describe("Foundation API (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ rawBody: true });
    app.use(cookieParser());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    const prisma = app.get(PrismaService);
    await prisma.job.deleteMany();
    await prisma.githubWebhookDelivery.deleteMany();
  });

  it("/healthz (GET)", () => {
    return request(app.getHttpServer())
      .get("/healthz")
      .expect(200)
      .expect({ status: "ok" });
  });

  it("/readyz (GET)", () => {
    return request(app.getHttpServer())
      .get("/readyz")
      .expect(200)
      .expect({ status: "ready" });
  });

  it("/api/v1/auth/me without a session (GET)", () => {
    return request(app.getHttpServer())
      .get("/api/v1/auth/me")
      .expect(401)
      .expect((response) => {
        expect(response.body.error.code).toBe("unauthorized");
      });
  });

  it("rejects an auth callback with mismatched state", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.get("/api/v1/auth/login").redirects(0).expect(302);

    await agent
      .get("/api/v1/auth/callback?code=fake-code&state=wrong")
      .redirects(0)
      .expect(302)
      .expect("Location", "http://localhost:5173/ar/portal/?auth=failed");
    await agent.get("/api/v1/auth/me").expect(401);
  });

  it("completes fake login, reads the catalog, then logs out", async () => {
    const agent = request.agent(app.getHttpServer());

    const login = await agent
      .get("/api/v1/auth/login")
      .redirects(0)
      .expect(302)
      .expect("Location", /\/api\/v1\/auth\/callback\?code=fake-code/);

    const callbackLocation = login.headers.location as string;
    const callbackUrl = new URL(callbackLocation);
    await agent
      .get(`${callbackUrl.pathname}${callbackUrl.search}`)
      .redirects(0)
      .expect(302)
      .expect("Location", "http://localhost:5173/ar/portal/");

    const me = await agent.get("/api/v1/auth/me").expect(200);
    expect(me.body.user.email).toBe("participant@elwarsha.dev");
    expect(me.body.roles).toEqual(["participant"]);
    expect(me.body.capabilities).toContain("portal.view");
    expect(me.body.memberships).toHaveLength(1);

    const products = await agent.get("/api/v1/products").expect(200);
    expect(products.body).toEqual(
      expect.arrayContaining([expect.objectContaining({ slug: "elwarsha-web" })]),
    );

    const engagements = await agent.get("/api/v1/engagements").expect(200);
    expect(engagements.body).toHaveLength(1);

// 1️⃣ استدعاء المهام والتأكد أنها ترجع مع الـ labels الخاصة بها
    const assignments = await agent.get("/api/v1/assignments").expect(200);
    expect(assignments.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          weekNumber: 1,
          labels: expect.any(Array), // 👈 تأكيد ارجاع الـ labels
        }),
      ]),
    );

    // 2️⃣ إضافة اختبار Endpoint الـ Labels المتاحة
    const labels = await agent.get("/api/v1/labels").expect(200);
    expect(Array.isArray(labels.body)).toBe(true);
    await agent.post("/api/v1/auth/logout").expect(201).expect({ ok: true });

    await agent.get("/api/v1/auth/me").expect(401);
    await agent.get("/api/v1/products").expect(401);
  });

  it("preserves requested locale when logging in from English portal", async () => {
    const agent = request.agent(app.getHttpServer());

    const login = await agent
      .get("/api/v1/auth/login?locale=en")
      .redirects(0)
      .expect(302)
      .expect("Location", /\/api\/v1\/auth\/callback\?code=fake-code/);

    const callbackLocation = login.headers.location as string;
    const callbackUrl = new URL(callbackLocation);
    await agent
      .get(`${callbackUrl.pathname}${callbackUrl.search}`)
      .redirects(0)
      .expect(302)
      .expect("Location", "http://localhost:5173/en/portal/");

    const me = await agent.get("/api/v1/auth/me").expect(200);
    expect(me.body.user.email).toBe("participant@elwarsha.dev");
  });

  it("rejects an unsigned GitHub webhook", () => {
    return request(app.getHttpServer())
      .post("/api/v1/github/webhooks")
      .set("x-github-delivery", "delivery-unsigned")
      .set("x-github-event", "ping")
      .send({ zen: "ok" })
      .expect(401)
      .expect((response) => {
        expect(response.body.error.code).toBe("unauthorized");
      });
  });

  it("accepts a signed GitHub webhook once", async () => {
    const body = '{"action":"opened"}';
    const signature = `sha256=${hmacSha256(
      process.env.GITHUB_WEBHOOK_SECRET ?? "replace-webhook-secret",
      body,
    )}`;
    const deliveryId = `delivery-${Date.now()}`;

    await request(app.getHttpServer())
      .post("/api/v1/github/webhooks")
      .set("content-type", "application/json")
      .set("x-hub-signature-256", signature)
      .set("x-github-delivery", deliveryId)
      .set("x-github-event", "pull_request")
      .send(body)
      .expect(201)
      .expect({ accepted: true });

    await request(app.getHttpServer())
      .post("/api/v1/github/webhooks")
      .set("content-type", "application/json")
      .set("x-hub-signature-256", signature)
      .set("x-github-delivery", deliveryId)
      .set("x-github-event", "pull_request")
      .send(body)
      .expect(201)
      .expect({ accepted: true });

    const delivery = await app.get(PrismaService).githubWebhookDelivery.findUnique({
      where: { deliveryId },
      include: { jobs: true },
    });
    expect(delivery?.jobs).toHaveLength(1);
  });

  it("claims a job once and reclaims an abandoned lease", async () => {
    const jobs = app.get(JobService);
    const prisma = app.get(PrismaService);
    const enqueued = await jobs.enqueue("reconcile_pull_requests", {
      requestedAt: new Date().toISOString(),
    });

    const claims = await Promise.all([jobs.claimNext(), jobs.claimNext()]);
    expect(claims.filter((claim) => claim?.id === enqueued.id)).toHaveLength(1);

    await prisma.job.update({
      where: { id: enqueued.id },
      data: { lockedAt: new Date(Date.now() - 6 * 60 * 1000) },
    });
    const reclaimed = await jobs.claimNext();
    expect(reclaimed?.id).toBe(enqueued.id);
    expect(reclaimed?.attemptCount).toBe(2);
  });

  afterEach(async () => {
    await app.close();
  });
});
