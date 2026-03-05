/**
 * @fileoverview Funciones de lógica pura para validaciones de registro.
 */

/**
 * Interfaz para el resultado de la fuerza de contraseña.
 */
export interface StrengthResult {
  label: string;
  color: string;
  width: string;
}

/**
 * Evalúa la robustez de una contraseña basándose en múltiples criterios de seguridad.
 * @param {string} pass - Contraseña a evaluar.
 * @returns {StrengthResult} Objeto con metadatos visuales (etiqueta, color y % de barra).
 */
export const evaluatePasswordStrength = (pass: string): StrengthResult => {
  // Si el campo está vacío, devolvemos la barra vacía
  if (!pass) return { label: '', color: 'transparent', width: '0%' };

  let score = 0;

  // 1. Longitud básica (al menos 6 caracteres)
  if (pass.length >= 6) score += 1;
  // 2. Longitud óptima (al menos 8 caracteres)
  if (pass.length >= 8) score += 1;
  // 3. Contiene minúsculas
  if (/[a-z]/.test(pass)) score += 1;
  // 4. Contiene mayúsculas
  if (/[A-Z]/.test(pass)) score += 1;
  // 5. Contiene números
  if (/[0-9]/.test(pass)) score += 1;
  // 6. Contiene caracteres especiales
  if (/[^A-Za-z0-9]/.test(pass)) score += 1;

  // La etiqueta y el color se actualizan siempre de forma conjunta según la puntuación.
  // Cualquier contraseña de menos de 6 caracteres será siempre evaluada como Baja.
  if (pass.length < 6) {
    return { label: 'Baja', color: '#ff4d4d', width: '33%' }; // Rojo
  } 
  
  // A partir de aquí, sabemos que tiene al menos 6 caracteres.
  if (score <= 3) {
    return { label: 'Baja', color: '#ff4d4d', width: '33%' }; // Rojo
  } else if (score === 4 || score === 5) {
    return { label: 'Media', color: '#ffd633', width: '66%' }; // Amarillo
  } else {
    // Solo llega aquí si tiene los 6 puntos (>=8 chars, min, mayus, num, especial)
    return { label: 'Alta', color: '#33cc33', width: '100%' }; // Verde
  }
};

/**
 * Lista predefinida de avatares del sistema.
 */
export const AVATARS = [
  { id: 'seniora.png', label: 'Avatar 1', src: '/avatars/seniora.png' },
  { id: 'disco.png', label: 'Avatar 2', src: '/avatars/disco.png' },
  { id: 'rubia.png', label: 'Avatar 3', src: '/avatars/rubia.png' },
  { id: 'elvis.png', label: 'Avatar 4', src: '/avatars/elvis.png' },
];