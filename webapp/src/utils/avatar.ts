export function resolveAvatarSrc(profilePicture?: string | null): string {
    const file = (profilePicture || "").trim();

    if (!file)
        return "/avatars/seniora.png";

    if (file.startsWith("http://") || file.startsWith("https://") || file.startsWith("/"))
        return file;

    return `/avatars/${file}`;
}