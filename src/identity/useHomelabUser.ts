import { ref, type Ref } from "vue";

// Who the app is serving, from server-kit's jwt strategy (`GET /api/me`). Mirrors server-kit's HomelabUser.
export interface HomelabUser {
  id: string;
  name: string;
  roles: string[];
  groups: string[];
  services: string[];
  // Set while an admin views as this person (the token's `act` claim).
  actor?: { id: string; name: string };
}

export interface HomelabUserOptions {
  // Default "/api/me".
  url?: string;
  fetch?: typeof fetch;
}

// Loads the caller once. Any failure (an app still on tailnet-trust has no
// /api/me, a 401 without a token) just leaves `user` null: identity is
// decoration here, the server enforces it.
export const useHomelabUser = (
  options: HomelabUserOptions = {},
): {
  user: Ref<HomelabUser | null>;
  loaded: Promise<void>;
} => {
  const user = ref<HomelabUser | null>(null);
  const doFetch = options.fetch ?? ((input, init) => fetch(input, init));
  const loaded = (async () => {
    try {
      const response = await doFetch(options.url ?? "/api/me", {
        headers: { accept: "application/json" },
      });
      if (!response.ok) return;
      const body = (await response.json()) as HomelabUser | null;
      user.value = body && typeof body.id === "string" ? body : null;
    } catch {
      // Not JSON, or unreachable: no identity to show.
    }
  })();
  return { user, loaded };
};
