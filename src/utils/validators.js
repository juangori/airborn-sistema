const Joi = require('joi');

const schemas = {
  login: Joi.object({
    usuario: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(4).max(100).required()
  }),

  crearUsuario: Joi.object({
    usuario: Joi.string().alphanum().min(3).max(30).required(),
    password: Joi.string().min(6).max(100).required(),
    nombreComercio: Joi.string().max(100).allow('').optional(),
    email: Joi.string().email().allow('').optional()
  }),

  venta: Joi.object({
    fecha: Joi.string().required(),
    articulo: Joi.string().allow('').optional(),
    cantidad: Joi.number().integer().min(1).required(),
    precio: Joi.number().min(0).required(),
    descuento: Joi.number().min(0).max(100).default(0),
    categoria: Joi.string().allow('').optional(),
    factura: Joi.string().allow('').optional(),
    tipoPago: Joi.string().allow('').optional(),
    comentarios: Joi.string().allow('').optional()
  }),

  productoNuevo: Joi.object({
    codigo: Joi.string().max(50).required(),
    descripcion: Joi.string().max(200).required(),
    categoria: Joi.string().max(50).allow('').optional(),
    precio: Joi.number().min(0).default(0),
    costo: Joi.number().min(0).default(0),
    stock: Joi.number().integer().min(0).default(0)
  }),

  stockUpdate: Joi.object({
    codigo: Joi.string().required(),
    nuevoStock: Joi.number().integer().min(0).required()
  }),

  movimientoCuenta: Joi.object({
    cliente: Joi.string().required(),
    tipo: Joi.string().valid('cargo', 'pago').required(),
    monto: Joi.number().min(0).required(),
    comentario: Joi.string().allow('').optional()
  })
};

function validar(schema, data) {
  const { error, value } = schema.validate(data, { stripUnknown: true });
  if (error) {
    return { error: error.details[0].message };
  }
  return { value };
}

module.exports = { schemas, validar };
