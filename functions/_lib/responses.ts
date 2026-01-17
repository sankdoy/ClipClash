export function jsonOk(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(init.headers ?? {})
    }
  })
}

export function jsonError(message: string, status = 400) {
  return jsonOk({ error: message }, { status })
}

export function badRequest(message: string) {
  return jsonError(message, 400)
}

export function unauthorized(message = 'Unauthorized') {
  return jsonError(message, 401)
}
