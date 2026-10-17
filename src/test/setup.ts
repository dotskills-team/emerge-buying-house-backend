// Loaded before every test file (see the "test" script). Never touches a real database.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/buying-house-test';
process.env.CLIENT_ORIGIN = 'http://localhost:3000';
process.env.CLOUDINARY_CLOUD_NAME = 'test';
process.env.CLOUDINARY_API_KEY = 'test';
process.env.CLOUDINARY_API_SECRET = 'test';
process.env.JWT_ACCESS_SECRET = 'test-secret-test-secret-test-secret-0123';
