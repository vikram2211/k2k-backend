import dotenv from 'dotenv';
dotenv.config();

const {
    MONGODB_URI,
    DB_NAME,
    PORT,
    CORS_ORIGIN,
    ACCESS_TOKEN_SECRET,
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_SECRET,
    REFRESH_TOKEN_EXPIRY,
} = process.env;

export {
    MONGODB_URI,
    DB_NAME,
    PORT,
    CORS_ORIGIN,
    ACCESS_TOKEN_SECRET,
    ACCESS_TOKEN_EXPIRY,
    REFRESH_TOKEN_SECRET,
    REFRESH_TOKEN_EXPIRY,
};