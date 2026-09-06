// Usa el mismo host con el que se accedió al frontend (localhost o una IP de LAN,
// p. ej. al probar desde el celular) en vez de un "localhost" fijo que en otro
// dispositivo apuntaría al dispositivo mismo, no a esta máquina.
export const environment = {
  production: false,
  apiUrl: `${window.location.protocol}//${window.location.hostname}:3000`,
};
