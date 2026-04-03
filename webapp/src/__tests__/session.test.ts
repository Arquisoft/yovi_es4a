import { beforeEach, describe, expect, it } from "vitest";
import {
  clearUserSession,
  getUserSession,
  isUserLoggedIn,
  saveUserSession,
} from "../utils/session";

describe("utils/session", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("saveUserSession y getUserSession funcionan", () => {
    saveUserSession({
      username: "marcelo",
      profilePicture: "avatar.png",
    });

    expect(getUserSession()).toEqual({
      username: "marcelo",
      profilePicture: "avatar.png",
    });
  });

  it("getUserSession devuelve null si no existe sesión", () => {
    expect(getUserSession()).toBeNull();
  });

  it("getUserSession devuelve null si el JSON es inválido", () => {
    localStorage.setItem("userSession", "{bad json");
    expect(getUserSession()).toBeNull();
  });

  it("getUserSession devuelve null si falta username", () => {
    localStorage.setItem("userSession", JSON.stringify({ foo: "bar" }));
    expect(getUserSession()).toBeNull();
  });

  it("clearUserSession elimina la sesión", () => {
    saveUserSession({ username: "marcelo" });
    clearUserSession();

    expect(getUserSession()).toBeNull();
  });

  it("isUserLoggedIn refleja el estado real", () => {
    expect(isUserLoggedIn()).toBe(false);

    saveUserSession({ username: "marcelo" });

    expect(isUserLoggedIn()).toBe(true);
  });
});