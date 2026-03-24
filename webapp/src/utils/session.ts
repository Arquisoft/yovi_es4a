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
        if (!parsed?.username)
            return null;

        return {
            username: parsed.username,
            profilePicture: parsed.profilePicture,
        };
    } catch {
        return null;
    }
}

export function saveUserSession(session: UserSession) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearUserSession() {
    localStorage.removeItem(SESSION_KEY);
}

export function isUserLoggedIn(): boolean {
    return !!getUserSession();
}