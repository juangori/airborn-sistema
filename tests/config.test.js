const config = require('../src/config');

describe('Configuración', () => {
  test('tiene puerto definido', () => {
    expect(config.port).toBeDefined();
    expect(typeof config.port).toBe('number');
  });

  test('tiene rutas de datos definidas', () => {
    expect(config.DATOS_DIR).toBe('./datos');
    expect(config.USUARIOS_DB).toContain('usuarios.db');
  });

  test('tiene configuración de sesión', () => {
    expect(config.session.secret).toBeDefined();
    expect(config.session.cookie.httpOnly).toBe(true);
    expect(config.session.cookie.sameSite).toBe('lax');
  });

  test('tiene rate limits configurados', () => {
    expect(config.rateLimit.general.max).toBeGreaterThan(0);
    expect(config.rateLimit.login.max).toBeGreaterThan(0);
    expect(config.rateLimit.login.max).toBeLessThan(config.rateLimit.general.max);
  });

  test('tiene orígenes CORS por defecto', () => {
    expect(Array.isArray(config.allowedOrigins)).toBe(true);
    expect(config.allowedOrigins.length).toBeGreaterThan(0);
  });
});
