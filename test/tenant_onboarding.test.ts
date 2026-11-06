import assert from "node:assert/strict";
import { InfraiClient, onboardTenant } from "../src/tenant_onboarding.ts";

const calls: Array<{ path: string; method: string; body?: Record<string, unknown> }> = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  calls.push({ path: new URL(url).pathname, method: init?.method ?? "", body: init?.body ? JSON.parse(String(init.body)) : undefined });
  const data = url.includes("/dns/domain/add") ? { zone_id: "zone_123" } : { url: "https://assets.example.test/upload" };
  return new Response(JSON.stringify({ ok: true, data, metadata: {} }), { status: 200, headers: { "content-type": "application/json" } });
};

try {
  const result = await onboardTenant(new InfraiClient("test-key"), {
    tenantId: "northwind", rootDomain: "saas.test", target: "edge.test", bucket: "assets", assetKey: "northwind/logo.svg"
  });
  assert.equal(result.hostname, "northwind.saas.test");
  assert.equal(result.zoneId, "zone_123");
  assert.equal(calls[1].body?.zone_id, "zone_123");
  assert.equal(calls[1].body?.record_type, "CNAME");
  assert.equal(calls[2].path, "/v1/storage/object/presign/assets/northwind%2Flogo.svg");
  assert.equal(calls[2].body?.op, "put");
} finally {
  globalThis.fetch = originalFetch;
}

console.log("tenant onboarding decision passed");
