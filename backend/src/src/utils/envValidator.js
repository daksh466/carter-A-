const Joi = require('joi');

const envSchema = Joi.object({
  MONGO_URI: Joi.string().uri().required(),
  JWT_SECRET: Joi.string().required(),
  PORT: Joi.number().integer().min(1).required()
}).unknown();

function validateEnv(env) {
  const { error } = envSchema.validate(env);
  if (error) {
    // eslint-disable-next-line no-console
    console.error('Environment variable validation error:', error.message);
    process.exit(1);
  }
}

module.exports = validateEnv;