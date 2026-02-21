interface Env {
  AWS_EDGE_BASE_URL: string;
}

export async function onRequest(context: { request: Request; env: Env; params: { path: string | string[] } }) {
  const { request, env, params } = context;
  const pathSegments = Array.isArray(params.path) ? params.path.join("/") : params.path;
  const upstreamBase = env.AWS_EDGE_BASE_URL || "http://127.0.0.1:8080";
  const url = new URL(request.url);
  const upstreamUrl = `${upstreamBase}/edge/${pathSegments}${url.search}`;

  const init: RequestInit = {
    method: request.method,
    headers: new Headers(request.headers),
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  try {
    const res = await fetch(upstreamUrl, init);
    const responseHeaders = new Headers(res.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");

    return new Response(res.body, {
      status: res.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: "Backend unreachable", detail: err.message }), {
      status: 502,
      headers: { "content-type": "application/json" },
    });
  }
}
