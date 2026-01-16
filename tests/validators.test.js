const { schemas, validar } = require('../src/utils/validators');

describe('Validaciones Joi', () => {

  describe('Login', () => {
    test('acepta credenciales válidas', () => {
      const { value, error } = validar(schemas.login, {
        usuario: 'admin',
        password: '1234'
      });
      expect(error).toBeUndefined();
      expect(value.usuario).toBe('admin');
    });

    test('rechaza usuario muy corto', () => {
      const { error } = validar(schemas.login, {
        usuario: 'ab',
        password: '1234'
      });
      expect(error).toBeDefined();
    });

    test('rechaza password vacío', () => {
      const { error } = validar(schemas.login, {
        usuario: 'admin',
        password: ''
      });
      expect(error).toBeDefined();
    });

    test('rechaza usuario con caracteres especiales', () => {
      const { error } = validar(schemas.login, {
        usuario: 'admin@test',
        password: '1234'
      });
      expect(error).toBeDefined();
    });
  });

  describe('Crear Usuario', () => {
    test('acepta usuario válido', () => {
      const { value, error } = validar(schemas.crearUsuario, {
        usuario: 'nuevousuario',
        password: '123456',
        nombreComercio: 'Mi Tienda',
        email: 'test@test.com'
      });
      expect(error).toBeUndefined();
      expect(value.usuario).toBe('nuevousuario');
    });

    test('rechaza password menor a 6 caracteres', () => {
      const { error } = validar(schemas.crearUsuario, {
        usuario: 'usuario',
        password: '12345'
      });
      expect(error).toBeDefined();
    });

    test('acepta email vacío', () => {
      const { value, error } = validar(schemas.crearUsuario, {
        usuario: 'usuario',
        password: '123456',
        email: ''
      });
      expect(error).toBeUndefined();
    });

    test('rechaza email inválido', () => {
      const { error } = validar(schemas.crearUsuario, {
        usuario: 'usuario',
        password: '123456',
        email: 'noesunemail'
      });
      expect(error).toBeDefined();
    });
  });

  describe('Venta', () => {
    test('acepta venta válida', () => {
      const { value, error } = validar(schemas.venta, {
        fecha: '2024-01-15',
        articulo: 'ABC123',
        cantidad: 2,
        precio: 100
      });
      expect(error).toBeUndefined();
      expect(value.cantidad).toBe(2);
    });

    test('acepta venta sin artículo', () => {
      const { value, error } = validar(schemas.venta, {
        fecha: '2024-01-15',
        cantidad: 1,
        precio: 50
      });
      expect(error).toBeUndefined();
    });

    test('rechaza cantidad 0', () => {
      const { error } = validar(schemas.venta, {
        fecha: '2024-01-15',
        cantidad: 0,
        precio: 100
      });
      expect(error).toBeDefined();
    });

    test('rechaza precio negativo', () => {
      const { error } = validar(schemas.venta, {
        fecha: '2024-01-15',
        cantidad: 1,
        precio: -10
      });
      expect(error).toBeDefined();
    });

    test('aplica descuento por defecto 0', () => {
      const { value } = validar(schemas.venta, {
        fecha: '2024-01-15',
        cantidad: 1,
        precio: 100
      });
      expect(value.descuento).toBe(0);
    });
  });

  describe('Producto Nuevo', () => {
    test('acepta producto válido', () => {
      const { value, error } = validar(schemas.productoNuevo, {
        codigo: 'PROD001',
        descripcion: 'Producto de prueba',
        precio: 99.99
      });
      expect(error).toBeUndefined();
      expect(value.codigo).toBe('PROD001');
    });

    test('rechaza código vacío', () => {
      const { error } = validar(schemas.productoNuevo, {
        codigo: '',
        descripcion: 'Test'
      });
      expect(error).toBeDefined();
    });

    test('rechaza descripción vacía', () => {
      const { error } = validar(schemas.productoNuevo, {
        codigo: 'ABC',
        descripcion: ''
      });
      expect(error).toBeDefined();
    });

    test('aplica valores por defecto', () => {
      const { value } = validar(schemas.productoNuevo, {
        codigo: 'ABC',
        descripcion: 'Test'
      });
      expect(value.precio).toBe(0);
      expect(value.costo).toBe(0);
      expect(value.stock).toBe(0);
    });
  });

  describe('Stock Update', () => {
    test('acepta actualización válida', () => {
      const { value, error } = validar(schemas.stockUpdate, {
        codigo: 'PROD001',
        nuevoStock: 10
      });
      expect(error).toBeUndefined();
      expect(value.nuevoStock).toBe(10);
    });

    test('rechaza stock negativo', () => {
      const { error } = validar(schemas.stockUpdate, {
        codigo: 'PROD001',
        nuevoStock: -5
      });
      expect(error).toBeDefined();
    });

    test('acepta stock 0', () => {
      const { value, error } = validar(schemas.stockUpdate, {
        codigo: 'PROD001',
        nuevoStock: 0
      });
      expect(error).toBeUndefined();
      expect(value.nuevoStock).toBe(0);
    });
  });
});
