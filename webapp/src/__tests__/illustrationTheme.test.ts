import { describe, it, expect, vi } from "vitest";

vi.mock("antd", () => ({
    theme: {
        defaultAlgorithm: "DEFAULT_ALGO",
    },
}));

import { illustrationTheme } from "../theme/illustrationTheme.ts";

describe("illustrationTheme", () => {
    it("expone el ThemeConfig con tokens y componentes esperados", () => {
        expect(illustrationTheme.algorithm).toBe("DEFAULT_ALGO");

        expect(illustrationTheme.token?.colorPrimary).toBe("#28BBF5");
        expect(illustrationTheme.token?.colorWarning).toBe("#FF7B00");
        expect(illustrationTheme.token?.borderRadius).toBe(16);

        expect(illustrationTheme.components?.Card?.borderRadiusLG).toBe(18);
        expect(illustrationTheme.components?.Button?.controlHeight).toBe(40);
        expect(illustrationTheme.components?.Modal?.contentBg).toBe("#FFFDFA");
    });
});