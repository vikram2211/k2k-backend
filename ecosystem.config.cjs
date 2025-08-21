const dotenv = require('dotenv');
const path = require('path');

// Load .env manually for PM2
dotenv.config({ path: path.resolve(__dirname, './.env') });

module.exports = {
  apps: [
    {
      name: "BackendServer",
      script: "./src/index.js", // main entry file
      watch: false,
      env: {
        DB_NAME: process.env.DB_NAME,
        PORT: process.env.PORT || 8000,
        MONGODB_URI: process.env.MONGODB_URI,
        CORS_ORIGIN: process.env.CORS_ORIGIN,
        ACCESS_TOKEN_SECRET: process.env.ACCESS_TOKEN_SECRET,
        REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET,
        ACCESS_TOKEN_EXPIRY: process.env.ACCESS_TOKEN_EXPIRY,
        REFRESH_TOKEN_EXPIRY: process.env.REFRESH_TOKEN_EXPIRY,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY,
        AWS_REGION: process.env.AWS_REGION,
        AWS_ACCESS_KEY: process.env.AWS_ACCESS_KEY,
        AWS_SECRET_KEY: process.env.AWS_SECRET_KEY,
        AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
        MQTT_BROKER: process.env.MQTT_BROKER
      }
    }
  ]
};
