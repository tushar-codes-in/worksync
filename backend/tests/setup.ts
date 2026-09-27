import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

// Minimum viable env for tests — env.ts validates with zod at import time.
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://placeholder/will-override';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-please-change';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-please-change';
process.env.JWT_RESET_SECRET = 'test-reset-secret-please-change';
process.env.JWT_INVITE_SECRET = 'test-invite-secret-please-change';
process.env.RESEND_API_KEY = '';
process.env.CLOUDINARY_CLOUD_NAME = 'test';
process.env.CLOUDINARY_API_KEY = 'test';
process.env.CLOUDINARY_API_SECRET = 'test';

let mongo: MongoMemoryServer;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const c of Object.values(collections)) await c.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});
