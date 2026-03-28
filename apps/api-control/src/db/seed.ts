import { db } from "./client";
import {
  tenants,
  users,
  projects,
  sites,
  streamProfiles,
  subscriptionPlans,
} from "./schema";
import crypto from "node:crypto";

async function seed() {
  console.log("Seeding database...");

  // 0. Subscription plans
  const planDefaults = [
    {
      name: "free",
      displayName: "Free",
      maxCameras: 5,
      maxProjects: 1,
      maxUsers: 2,
      viewerHoursQuota: 100,
      auditRetentionDays: 7,
      features: JSON.stringify({
        webrtc: false,
        embed: false,
        api_access: false,
        csv_import: false,
        webhooks: false,
        recording: false,
        sso: false,
      }),
      priceCents: 0,
      billingInterval: "monthly",
    },
    {
      name: "starter",
      displayName: "Starter",
      maxCameras: 50,
      maxProjects: 5,
      maxUsers: 10,
      viewerHoursQuota: 1000,
      auditRetentionDays: 30,
      features: JSON.stringify({
        webrtc: true,
        embed: true,
        api_access: true,
        csv_import: true,
        webhooks: false,
        recording: false,
        sso: false,
      }),
      priceCents: 4900,
      billingInterval: "monthly",
    },
    {
      name: "pro",
      displayName: "Pro",
      maxCameras: 500,
      maxProjects: 25,
      maxUsers: 50,
      viewerHoursQuota: 10000,
      auditRetentionDays: 90,
      features: JSON.stringify({
        webrtc: true,
        embed: true,
        api_access: true,
        csv_import: true,
        webhooks: true,
        recording: true,
        sso: false,
      }),
      priceCents: 19900,
      billingInterval: "monthly",
    },
    {
      name: "enterprise",
      displayName: "Enterprise",
      maxCameras: 999999,
      maxProjects: 999999,
      maxUsers: 999999,
      viewerHoursQuota: 999999,
      auditRetentionDays: 365,
      features: JSON.stringify({
        webrtc: true,
        embed: true,
        api_access: true,
        csv_import: true,
        webhooks: true,
        recording: true,
        sso: true,
      }),
      priceCents: 0, // custom pricing
      billingInterval: "monthly",
    },
  ];

  for (const plan of planDefaults) {
    const [created] = await db
      .insert(subscriptionPlans)
      .values(plan)
      .onConflictDoNothing({ target: subscriptionPlans.name })
      .returning();

    if (created) {
      console.log(`  Created plan: ${created.displayName} (${created.id})`);
    } else {
      console.log(`  Plan '${plan.name}' already exists, skipping.`);
    }
  }

  // Get the free plan ID for assigning to demo tenant
  const freePlan = await db.query.subscriptionPlans.findFirst({
    where: (await import("drizzle-orm")).eq(subscriptionPlans.name, "free"),
  });

  // 1. Demo tenant
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: "Demo Corp",
      slug: "demo-corp",
      billingEmail: "admin@demo.com",
      subscriptionPlanId: freePlan?.id,
    })
    .onConflictDoNothing({ target: tenants.slug })
    .returning();

  if (tenant) {
    console.log(`  Created tenant: ${tenant.name} (${tenant.id})`);
  } else {
    console.log("  Tenant 'demo-corp' already exists, skipping.");
  }

  // We need the tenant id for subsequent inserts — fetch if it already existed
  const tenantId =
    tenant?.id ??
    (
      await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(
          // eslint-disable-next-line @typescript-eslint/no-var-requires
          (await import("drizzle-orm")).eq(tenants.slug, "demo-corp"),
        )
        .limit(1)
    )[0]!.id;

  // 1b. Default stream profile
  const [streamProfile] = await db
    .insert(streamProfiles)
    .values({
      tenantId,
      name: "Default",
      description:
        "Standard output — HLS, audio included, original framerate",
      outputProtocol: "hls",
      audioMode: "include",
      maxFramerate: 0,
      isDefault: true,
    })
    .onConflictDoNothing()
    .returning();

  if (streamProfile) {
    console.log(
      `  Created stream profile: ${streamProfile.name} (${streamProfile.id})`,
    );
  } else {
    console.log("  Default stream profile already exists, skipping.");
  }

  // 2. Demo admin user
  const [user] = await db
    .insert(users)
    .values({
      tenantId,
      email: "demo@example.com",
      name: "Demo Admin",
      role: "admin",
    })
    .onConflictDoNothing()
    .returning();

  if (user) {
    console.log(`  Created user: ${user.email} (${user.id})`);
  } else {
    console.log("  User 'demo@example.com' already exists, skipping.");
  }

  // 3. Demo project
  const publicKey = crypto.randomBytes(16).toString("hex");

  const [project] = await db
    .insert(projects)
    .values({
      tenantId,
      name: "Main Project",
      publicKey,
    })
    .onConflictDoNothing()
    .returning();

  if (project) {
    console.log(`  Created project: ${project.name} (${project.id})`);
  } else {
    console.log("  Project already exists, skipping.");
  }

  const projectId =
    project?.id ??
    (
      await db
        .select({ id: projects.id })
        .from(projects)
        .where(
          (await import("drizzle-orm")).eq(projects.tenantId, tenantId),
        )
        .limit(1)
    )[0]?.id;

  // 4. Demo site
  if (projectId) {
    const [site] = await db
      .insert(sites)
      .values({
        projectId,
        tenantId,
        name: "HQ Office",
        lat: 13.7563,
        lng: 100.5018,
      })
      .onConflictDoNothing()
      .returning();

    if (site) {
      console.log(`  Created site: ${site.name} (${site.id})`);
    } else {
      console.log("  Site already exists, skipping.");
    }
  }

  console.log("Seed complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
