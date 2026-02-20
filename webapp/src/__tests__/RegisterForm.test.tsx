import { render, screen,  waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RegisterForm from '../RegisterForm'
import { afterEach, describe, expect, test, vi } from 'vitest' 
import '@testing-library/jest-dom'


describe('RegisterForm', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('shows validation error when username is empty', async () => {
    render(<RegisterForm />)
    const user = userEvent.setup()

    await waitFor(async () => {
      await user.click(screen.getByRole('button', { name: /lets go!/i }))
      expect(screen.getByText(/please enter a username/i)).toBeInTheDocument()
    })
  })

  test('submits username and displays response', async () => {
    const user = userEvent.setup()

    // Mock fetch to resolve automatically
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: 'Hello Pablo! Welcome to the course!' }),
    } as Response)

    render(<RegisterForm />)

    // Wrap interaction + assertion inside waitFor
    await waitFor(async () => {
      await user.type(screen.getByLabelText(/whats your name\?/i), 'Pablo')
      await user.click(screen.getByRole('button', { name: /lets go!/i }))

      // Response message should appear
      expect(
        screen.getByText(/hello pablo! welcome to the course!/i)
      ).toBeInTheDocument()
    })
  })

  test('muestra "Server error" cuando res.ok es false y no hay data.error', async () => {
    const user = userEvent.setup()

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as any)

    render(<RegisterForm />)

    await user.type(screen.getByLabelText(/whats your name\?/i), 'Pablo')
    await user.click(screen.getByRole('button', { name: /lets go!/i }))

    expect(await screen.findByText(/server error/i)).toBeInTheDocument()
  })

  test("muestra el mensaje de error cuando fetch rechaza con Error(message)", async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Connection lost"));

    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/whats your name\?/i), "Pablo");
    await user.click(screen.getByRole("button", { name: /lets go!/i }));

    expect(await screen.findByText(/connection lost/i)).toBeInTheDocument();
  });

  test('muestra "Network error" cuando fetch rechaza sin message', async () => {
    const user = userEvent.setup();

    // Rechazamos con un objeto sin "message" (para forzar el fallback del OR)
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce({});

    render(<RegisterForm />);

    await user.type(screen.getByLabelText(/whats your name\?/i), "Pablo");
    await user.click(screen.getByRole("button", { name: /lets go!/i }));

    expect(await screen.findByText(/network error/i)).toBeInTheDocument();
  });

})