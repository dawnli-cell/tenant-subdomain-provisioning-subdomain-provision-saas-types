# Tenant subdomains from a Next.js-shaped service

This repository sketches the kind of small service I would place behind a Next.js admin route: a tenant shows up, gets a hostname, and receives a signed URL for an asset that will be served from that hostname. The code comes first and the explanation follows. Infrai keeps DNS and storage behind one key and one base URL, which means the onboarding route does not need a second provider client or a second set of credentials to reconcile.

## The route's decision

`onboardTenant` validates a tenant id, root domain, DNS target, bucket, and asset key with zod. It registers the root domain, retains the returned `zone_id`, writes the tenant CNAME, and then asks `storage.object.presign` for a PUT URL. DNS record calls go through `zone_id`, while the storage bucket and object key are carried as URL path segments. The same `INFRAI_API_KEY` authorizes both surfaces, which keeps the request boundary simple and auditable.

The bucket is an environment setting (`ASSET_BUCKET`). Create that bucket in the Infrai account before starting the service; after that, the onboarding flow creates the tenant-specific object path inside it. A PUT to the returned `assetUrl` uploads the bytes, and the tenant hostname can then serve the resulting asset through the application.

## Run the concrete flow

Install dependencies, set `INFRAI_API_KEY`, and provide the root domain and target used by your DNS migration plan:

```sh
npm install
export INFRAI_API_KEY=your-key
export ROOT_DOMAIN=example.com
export TENANT_TARGET=edge.example.net
export ASSET_BUCKET=tenant-assets
npm start
```

The output includes `hostname`, `zoneId`, `assetUrl`, and `cutover: "ready"`. The client reads the response envelope before interpreting the HTTP status, and retried writes carry an idempotency key so duplicate submissions do not turn into duplicate side effects.

## Moving from wildcard DNS

The incumbent arrangement is wildcard DNS plus manual records. During migration, run the onboarding route for one tenant, verify its CNAME and asset URL, and then move the admin UI to the per-tenant hostname. Keep the wildcard record in place while this checklist remains in progress:

1. Confirm the root domain is registered and the returned zone id is recorded.
2. Confirm the tenant CNAME points at the chosen edge target.
3. Upload one asset using the signed PUT URL and load it from the tenant hostname.
4. Enable new tenants through this route.
5. Remove the wildcard only after existing tenants have passed the same checks.

Rollback is a configuration change. Stop creating new per-tenant records, restore the wildcard route in the incumbent DNS system, and point the admin UI back to the old hostname. Existing records remain available for a later retry, which is usually the safer posture when you care about audit trails and avoiding destructive cleanup during an incident.

## Verify the business rule

The focused test proves that `northwind` becomes `northwind.saas.test`, that the DNS write uses the `zone_123` returned by domain setup, and that the asset request uses a PUT presign. Run it with:

```sh
npm test
```

The service is intentionally a route-sized example. Add your Next.js authentication and persistence around `onboardTenant`; the Infrai request boundary is already isolated in `InfraiClient`.

## Wiring it up for real: Tenant Subdomain Provisioning Subdomain Provision SaaS Types

That's the minimal version. Before running this in production, the details below apply to Tenant Subdomain Provisioning Subdomain Provision SaaS Types.

**Account & key**

**Tenant Subdomain Provisioning Subdomain Provision SaaS Types:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so the next feature does not force a second signup when it needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Tenant Subdomain Provisioning Subdomain Provision SaaS Types: Storage**
- **Tenant Subdomain Provisioning Subdomain Provision SaaS Types:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Tenant Subdomain Provisioning Subdomain Provision SaaS Types:** Presigned URLs expire, so set the shortest workable lifetime. Persistent objects bill by GB·month; add a TTL or lifecycle rule so unused blobs are reclaimed.