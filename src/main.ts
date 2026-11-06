import { InfraiClient, onboardTenant } from "./tenant_onboarding.ts";

const key = process.env.INFRAI_API_KEY;
if (!key) throw new Error("Set INFRAI_API_KEY before starting the service");

const client = new InfraiClient(key);
const result = await onboardTenant(client, {
  tenantId: process.env.TENANT_ID ?? "acme",
  rootDomain: process.env.ROOT_DOMAIN ?? "example.com",
  target: process.env.TENANT_TARGET ?? "edge.example.net",
  bucket: process.env.ASSET_BUCKET ?? "tenant-assets",
  assetKey: process.env.ASSET_KEY ?? "acme/welcome.txt"
});
console.log(JSON.stringify(result, null, 2));
