export type UserSession = {
    username: string;
    profilePicture?: string;
};

const SESSION_KEY = "userSession";

export function getUserSession(): UserSession | null {
    try {
        const raw = localStorage.getItem(SESSION_KEY);
        if (!raw)
            return null;

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.username !== "string" || !parsed.username.trim()) {
            clearUserSession();
            return null;
        }

        return {
            username: parsed.username,
            profilePicture:
                typeof parsed.profilePicture === "string"
                    ? parsed.profilePicture
                    : undefined,
        };
    } catch {
        clearUserSession();
        return null;
    }
}

export function saveUserSession(session: UserSession) {
    localStorage.setItem(
        SESSION_KEY,
        JSON.stringify({
            username: session.username,
            profilePicture: session.profilePicture,
        })
    );
}

export function clearUserSession() {
    localStorage.removeItem(SESSION_KEY);
}

export function isUserLoggedIn(): boolean {
    return !!getUserSession();
}