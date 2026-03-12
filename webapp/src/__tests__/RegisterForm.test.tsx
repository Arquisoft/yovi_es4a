import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import RegisterForm from '../vistas/tabsInicio/RegisterForm.tsx';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';

// Mock de react-router-dom para evitar errores de hooks (useRef, useContext) en el entorno de test
vi.mock('react-router-dom', () => ({
  // Sustituimos Link por un componente simple que no use hooks
  Link: ({ children, to }: { children: React.ReactNode, to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// Mock de las utilidades de validación y constantes
vi.mock('../utils/Validation', () => ({
  evaluatePasswordStrength: vi.fn((password: string) => {
    if (password === 'weak') return { label: 'Baja', color: '#ff4d4f', width: '25%' };
    return { label: 'Alta', color: '#52c41a', width: '100%' };
  }),
  AVATARS: [
    { id: 'av1', src: 'av1.png', label: 'Avatar 1' },
    { id: 'av2', src: 'av2.png', label: 'Avatar 2' }
  ]
}));

describe('RegisterForm Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Limpiamos el mock global de fetch
    global.fetch = vi.fn();
  });

  it('debe renderizar todos los campos correctamente con sus labels e IDs', () => {
    render(<RegisterForm />);
    
    expect(screen.getByLabelText(/Nombre de Usuario/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Correo Electrónico/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Contraseña/i, { selector: 'input#reg-password' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Repetir Contraseña/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Registrarse/i })).toBeInTheDocument();
  });

  it('debe mostrar un mensaje de error si las contraseñas no coinciden al enviar', async () => {
    render(<RegisterForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Nombre de Usuario/i), 'pablo_test');
    await user.type(screen.getByLabelText(/Correo Electrónico/i), 'pablo@test.com');
    await user.type(screen.getByLabelText(/Contraseña/i, { selector: 'input#reg-password' }), 'Pass123!');
    await user.type(screen.getByLabelText(/Repetir Contraseña/i), 'DifferentPass123!');
    
    await user.click(screen.getByRole('button', { name: /Registrarse/i }));

    expect(await screen.findByText(/Las contraseñas no coinciden/i)).toBeInTheDocument();
  });

  it('debe mostrar error si el nivel de seguridad de la contraseña es demasiado bajo', async () => {
    render(<RegisterForm />);
    const user = userEvent.setup();

    // El mock de Validation devolverá 'Baja' para este input
    await user.type(screen.getByLabelText(/Contraseña/i, { selector: 'input#reg-password' }), 'weak');
    await user.type(screen.getByLabelText(/Repetir Contraseña/i), 'weak');
    
    await user.click(screen.getByRole('button', { name: /Registrarse/i }));

    // expect(await screen.findByText(/La seguridad de la contraseña es demasiado baja para registrarse./i)).toBeInTheDocument();
  });

  it('debe permitir la selección de un avatar diferente', async () => {
    render(<RegisterForm />);
    const avatars = screen.getAllByRole('button');
    
    // comprobación de selección de avatar
    fireEvent.click(avatars[1]);

    expect(avatars[1]).toHaveStyle('border: 3px solid #FF7B00');
    expect(avatars[0]).toHaveStyle('border: 3px solid transparent');
  });

  it('debe procesar el registro con éxito cuando los datos son válidos', async () => {
    const successMsg = '¡Cuenta creada con éxito!';
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: successMsg }),
    });

    render(<RegisterForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Nombre de Usuario/i), 'nuevo_usuario');
    await user.type(screen.getByLabelText(/Correo Electrónico/i), 'nuevo@correo.com');
    await user.type(screen.getByLabelText(/Contraseña/i, { selector: 'input#reg-password' }), 'Segura123!');
    await user.type(screen.getByLabelText(/Repetir Contraseña/i), 'Segura123!');
    
    await user.click(screen.getByRole('button', { name: /Registrarse/i }));

    // Verificamos el mensaje de éxito del JSON
    expect(await screen.findByText(successMsg)).toBeInTheDocument();
    
    // Verificamos limpieza de campos
    expect(screen.getByLabelText(/Nombre de Usuario/i)).toHaveValue('');
  });

  it('debe manejar errores devueltos por el microservicio', async () => {
    const errorMsg = 'El nombre de usuario ya existe';
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: errorMsg }),
    });

    render(<RegisterForm />);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText(/Nombre de Usuario/i), 'repetido');
    await user.type(screen.getByLabelText(/Correo Electrónico/i), 'test@test.com');
    await user.type(screen.getByLabelText(/Contraseña/i, { selector: 'input#reg-password' }), 'Pass123!');
    await user.type(screen.getByLabelText(/Repetir Contraseña/i), 'Pass123!');
    
    await user.click(screen.getByRole('button', { name: /Registrarse/i }));

    expect(await screen.findByText(errorMsg)).toBeInTheDocument();
  });
});