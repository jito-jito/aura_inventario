export const environment = {
  production: true,
  // Despliegue en Railway: frontend y backend son servicios separados con dominios
  // públicos propios (no hay un nginx que reenvíe /api al backend por red interna),
  // así que el build apunta directo al dominio del backend.
  apiUrl: 'https://backend-aura-inventario.up.railway.app',
};
