export default function claimsToolsPlugin(api: any) {
  const cfg = api.config?.plugins?.entries?.["claims-tools"]?.config;

  function baseUrl(): string {
    return cfg?.apiBaseUrl ?? process.env.CLAIMS_API_BASE_URL ?? "http://127.0.0.1:8080";
  }

  api.registerTool({
    name: "claims.get_summary",
    description: "Fetch a sanitized claim summary by claim_id. Returns the full claim object with stage, compliance deadlines, and event history.",
    parameters: {
      type: "object",
      properties: {
        claim_id: { type: "string", description: "The claim ID (e.g., CLM-xxxx)" },
      },
      required: ["claim_id"],
    },
    async execute(_id: string, params: { claim_id: string }) {
      const res = await fetch(`${baseUrl()}/internal/tools/claims/summary/${params.claim_id}`);
      if (!res.ok) throw new Error(`claims.get_summary failed: ${res.status}`);
      const data = await res.json();
      return { content: [{ type: "text", text: JSON.stringify(data) }] };
    },
  });

  api.registerTool({
    name: "claims.write_stage_result",
    description: "Persist a stage result for a claim. Appends an immutable event to the audit trail and transitions the claim stage.",
    parameters: {
      type: "object",
      properties: {
        claim_id: { type: "string", description: "The claim ID" },
        stage: { type: "string", description: "The target stage (e.g., FRONTDESK_DONE)" },
        result: { type: "object", description: "The stage output JSON matching the agent's OUTPUT_SCHEMA" },
      },
      required: ["claim_id", "stage", "result"],
    },
    async execute(_id: string, params: { claim_id: string; stage: string; result: any }) {
      const res = await fetch(`${baseUrl()}/internal/tools/claims/stage_result`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(`claims.write_stage_result failed: ${res.status}`);
      const data = await res.json();
      return { content: [{ type: "text", text: JSON.stringify(data) }] };
    },
  });

  api.registerTool({
    name: "claims.list_attachments",
    description: "List attachment keys for a claim from S3.",
    parameters: {
      type: "object",
      properties: {
        claim_id: { type: "string", description: "The claim ID" },
      },
      required: ["claim_id"],
    },
    async execute(_id: string, params: { claim_id: string }) {
      const res = await fetch(`${baseUrl()}/edge/claims/${params.claim_id}/attachments`);
      if (!res.ok) throw new Error(`claims.list_attachments failed: ${res.status}`);
      const data = await res.json();
      return { content: [{ type: "text", text: JSON.stringify(data) }] };
    },
  });
}
