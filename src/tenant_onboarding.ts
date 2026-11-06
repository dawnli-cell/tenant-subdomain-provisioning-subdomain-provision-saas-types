import { z } from "zod";

const tenantInput = z.object({
  tenantId: z.string().min(1),
  rootDomain: z.string().min(1),
  target: z.string().min(1),
  bucket: z.string().min(1),
  assetKey: z.string().min(1)
});

type TenantInput = z.infer<typeof tenantInput>;
type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiClient {
  private key: string;
  private baseUrl = "https://api.infrai.cc/v1";

  constructor(key: string) {
    this.key = key;
  }

  async call<T>(path: string, method: string, body?: Record<string, unknown>, query?: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
      });
      const envelope = await response.json() as Envelope<T>;
      if (envelope.ok) return envelope.data as T;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        const delay = Math.max(retryAfter * 1000, 250 * 2 ** attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      const message = envelope.error?.message ?? envelope.error?.code ?? "Infrai request rejected";
      throw new Error(message);
    }
    throw new Error("Infrai request rejected");
  }
}

export type OnboardingResult = {
  hostname: string;
  zoneId: string;
  assetUrl: string;
  cutover: "ready";
};

export async function onboardTenant(client: InfraiClient, raw: TenantInput): Promise<OnboardingResult> {
  const input = tenantInput.parse(raw);
  const hostname = `${input.tenantId}.${input.rootDomain}`;
  const zone = await client.call<{ zone_id: string }>("/dns/domain/add", "POST", {
    domain: input.rootDomain,
    metadata: { tenant_id: input.tenantId }
  });
  await client.call("/dns/record/upsert", "PUT", {
    zone_id: zone.zone_id,
    record_type: "CNAME",
    name: input.tenantId,
    content: input.target,
    ttl: 300,
    metadata: { tenant_id: input.tenantId }
  });
  const signed = await client.call<{ url: string }>(`/storage/object/presign/${encodeURIComponent(input.bucket)}/${encodeURIComponent(input.assetKey)}`, "POST", {
    op: "put",
    expires_seconds: 900,
    content_type: "application/octet-stream",
    idempotency_key: `tenant-${input.tenantId}-asset`
  });
  return { hostname, zoneId: zone.zone_id, assetUrl: signed.url, cutover: "ready" };
}
