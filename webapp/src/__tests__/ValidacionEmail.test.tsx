import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import VerifyEmail from "../vistas/registroLogin/ValidacionEmail";
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
} from "vitest";
import "@testing-library/jest-dom";

// 1. Mocks de react-router-dom
const mockNavigate = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [mockSearchParams],
}));

describe("VerifyEmail Component", () => {
  beforeAll(() => {
    // Mock obligatorio de window.matchMedia para que Ant Design no falle
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
    // Reseteamos los search parameters antes de cada test por defecto
    mockSearchParams = new URLSearchParams();
  });

  afterEach(() => {
    // Restauramos los temporizadores por si algún test los modificó
    vi.useRealTimers();
  });

  it("debe mostrar un error inmediatamente si no hay token en la URL", async () => {
    // No añadimos token a mockSearchParams
    render(<VerifyEmail />);

    // Verificamos que el estado de error se muestra directamente
    expect(screen.getByText("Fallo en la verificación")).toBeInTheDocument();
    expect(
      screen.getByText("Enlace no válido. Falta el código de verificación."),
    ).toBeInTheDocument();

    // Verificamos que no se hace ninguna llamada a la API si no hay token
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("debe mostrar el estado de carga y luego éxito si la API responde correctamente", async () => {
    // 1. Preparamos el mock del token en la URL
    const token = "token-valido-123";
    mockSearchParams = new URLSearchParams(`?token=${token}`);

    // 2. Preparamos la respuesta de la API
    const successMsg = "¡Tu correo ha sido verificado!";
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: successMsg }),
    });

    // 3. Activamos temporizadores falsos para testear el setTimeout
    vi.useFakeTimers();

    render(<VerifyEmail />);

    // Inicialmente debe mostrar el texto de carga de forma síncrona
    expect(
      screen.getByText("Verificando tu cuenta en nuestros servidores..."),
    ).toBeInTheDocument();

    // SOLUCIÓN AL TIMEOUT: En lugar de usar findByText (que hace polling y se bloquea con
    // fakeTimers), forzamos la resolución de las promesas avanzando un pequeño instante asíncrono.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10); // 10ms son suficientes para que resuelva el fetch
    });

    // Como ya avanzó el hilo, verificamos el DOM sincronamente usando getByText
    expect(screen.getByText("¡Cuenta verificada!")).toBeInTheDocument();
    expect(screen.getByText(successMsg)).toBeInTheDocument();

    // Verificamos que se hizo la petición con el token correcto
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/verify?token=${token}`),
    );

    // 4. Verificamos la redirección automática (setTimeout)
    // Primero, confirmamos que AÚN NO ha navegado
    expect(mockNavigate).not.toHaveBeenCalled();

    // Avanzamos el tiempo virtual restando los 10ms que usamos arriba (3000ms - 10ms = 2990ms)
    act(() => {
      vi.advanceTimersByTime(2990);
    });

    // Ahora SÍ debió haber navegado a /home
    expect(mockNavigate).toHaveBeenCalledWith("/home");
  });

  it("debe manejar errores de la API si el token es inválido o expiró", async () => {
    const token = "token-expirado";
    mockSearchParams = new URLSearchParams(`?token=${token}`);

    const errorMsg = "El enlace de verificación ha expirado.";
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: errorMsg }),
    });

    render(<VerifyEmail />);

    // Esperamos a que la vista se actualice con el error del servidor
    expect(
      await screen.findByText("Fallo en la verificación"),
    ).toBeInTheDocument();
    expect(screen.getByText(errorMsg)).toBeInTheDocument();
  });

  it("el botón de 'Ir al Home ahora' debe redirigir manualmente", async () => {
    mockSearchParams = new URLSearchParams("?token=valido");
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "OK" }),
    });

    render(<VerifyEmail />);
    const user = userEvent.setup();

    // Buscamos el botón de éxito (aparece después de la carga)
    const btn = await screen.findByRole("button", {
      name: /Ir al Home ahora/i,
    });

    await user.click(btn);

    expect(mockNavigate).toHaveBeenCalledWith("/home");
  });

  it("el botón de 'Volver al Inicio' debe redirigir manualmente en caso de error", async () => {
    // Sin token causará un error automático sin cargar
    render(<VerifyEmail />);
    const user = userEvent.setup();

    const btn = screen.getByRole("button", { name: /Volver al Inicio/i });

    await user.click(btn);

    // Redirige a "/" según tu código
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
