// What AppShell needs to show who you are. server-kit's /api/me answer
// (HomelabUser) fits as is; an app with its own /api/me passes this
// shape directly.
export interface ShellUser {
  id: string;
  name: string;
  roles?: string[];
  // Set while an admin views as this person (the token's `act` claim).
  actor?: { id: string; name: string };
  deviceName?: string;
  // Overrides `<avatarBaseUrl><id>`.
  avatarUrl?: string;
}

// Where avatars live, as `<base><user id>`. Empty by default (initials only);
// an app whose identity provider serves avatars passes its URL to AppShell's
// `avatar-base-url`.
export const DEFAULT_AVATAR_BASE_URL = "";

// First code point, so an emoji or astral letter isn't cut in half.
const firstCharacter = (text: string): string => {
  const codePoint = text.codePointAt(0);
  return codePoint === undefined ? "" : String.fromCodePoint(codePoint);
};

// "Marek Uncik" -> "MU", "jana" -> "J". First letter of the first and last
// word, so a middle name doesn't push the surname out.
export const initials = (name: string): string => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const firstWord = words.at(0);
  if (firstWord === undefined) return "?";
  const lastWord = words.length > 1 ? words.at(-1) : undefined;
  const last = lastWord === undefined ? "" : firstCharacter(lastWord);
  return (firstCharacter(firstWord) + last).toUpperCase();
};

// The user's own avatarUrl wins; otherwise base + id. An empty base means
// no image, so the avatar shows initials.
export const avatarSrc = (
  user: Pick<ShellUser, "id" | "avatarUrl">,
  baseUrl = DEFAULT_AVATAR_BASE_URL,
): string | undefined => {
  if (user.avatarUrl) return user.avatarUrl;
  return baseUrl ? baseUrl + encodeURIComponent(user.id) : undefined;
};
