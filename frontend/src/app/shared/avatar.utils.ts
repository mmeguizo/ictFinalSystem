export type AvatarIdentity = {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  picture?: string | null;
};

export function normalizeAvatar(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function resolveAvatarUrl(identity: AvatarIdentity | null | undefined): string | null {
  if (!identity) return null;
  return normalizeAvatar(identity.avatarUrl) ?? normalizeAvatar(identity.picture);
}

export function getAvatarInitial(
  name: string | null | undefined,
  email: string | null | undefined,
): string {
  const source = name?.trim() || email?.trim() || '?';
  const firstVisibleChar = source.match(/[A-Za-z0-9]/)?.[0] ?? '?';
  return firstVisibleChar.toUpperCase();
}
