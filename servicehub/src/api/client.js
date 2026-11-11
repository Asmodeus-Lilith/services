// api/client.js
//
// Single place that talks to the PostgreSQL-backed API. Everything else in the
// app goes through `apiRequest`, so the base URL, the bearer token and the
// guest key are handled exactly once.

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const TOKEN_KEY = 'servicehub_token';
const GUEST_KEY = 'servicehub_guest_key';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

const readStore = (key) => {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
};

const writeStore = (key, value) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch (_) {
    /* private mode: keep working without persistence */
  }
};

export const getToken = () => readStore(TOKEN_KEY);

export const setToken = (token) => writeStore(TOKEN_KEY, token || null);

/**
 * A stable, anonymous id for this browser. The API uses it to keep a guest's
 * bookings private to them, and to hand them over on sign-in.
 */
export const getGuestKey = () => {
  let key = readStore(GUEST_KEY);

  if (!key) {
    key =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    writeStore(GUEST_KEY, key);
  }

  return key;
};

/**
 * Performs a request against the API.
 * Handles JSON bodies, FormData, and binary uploads seamlessly.
 * Throws {@link ApiError} with a message safe to show the user.
 */
export async function apiRequest(path, { method = 'GET', body, headers: customHeaders, signal } = {}) {
  const headers = { 'X-Guest-Key': getGuestKey(), ...(customHeaders || {}) };

  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
  const isBlob = typeof Blob !== 'undefined' && body instanceof Blob;

  if (body !== undefined && !isFormData && !isBlob && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const token = getToken();
  if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;

  let requestBody;
  if (body === undefined) {
    requestBody = undefined;
  } else if (isFormData || isBlob) {
    requestBody = body;
  } else if (typeof body === 'string') {
    requestBody = body;
  } else {
    requestBody = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      signal,
      body: requestBody
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError(
      'Could not reach the ServiceHub API. Is the backend running?',
      0
    );
  }

  if (response.status === 204) return null;

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (_) {
      payload = null;
    }
  }

  if (!response.ok) {
    const isMessagingEndpoint = /^\/messages(?:\/|$)/.test(path);
    const isUnregisteredMessageRoute =
      isMessagingEndpoint && response.status === 404 && payload?.error === 'Unknown API endpoint';

    let errorMessage = payload?.error;
    if (!errorMessage) {
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        errorMessage = 'API server is not responding (502 Bad Gateway). Please make sure the backend server is running on port 4000.';
      } else {
        errorMessage = `Request failed (${response.status})`;
      }
    }

    throw new ApiError(
      isUnregisteredMessageRoute
        ? 'Messaging is not available on the connected API yet. Restart the API server or rebuild and redeploy the latest app.'
        : errorMessage,
      response.status
    );
  }

  return payload;
}

/**
 * Uploads one or more photo files from the user's PC to the provider upload endpoint.
 * Accepts a File, FileList, or array of File objects.
 * Returns { url, urls, files }.
 */
export async function uploadProviderPhotos(files) {
  const formData = new FormData();
  if (Array.isArray(files) || (typeof FileList !== 'undefined' && files instanceof FileList)) {
    for (const file of files) {
      formData.append('files', file);
    }
  } else if (files) {
    formData.append('files', files);
  }
  return apiRequest('/provider/upload', {
    method: 'POST',
    body: formData
  });
}
