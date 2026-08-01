export const environment = {
  production: true,
  // Ruta relativa: en producción el mismo servidor web (nginx) que sirve la PWA
  // reenvía /api/* al backend, así no hace falta hornear un dominio en el build.
  apiUrl: '/api',
};
