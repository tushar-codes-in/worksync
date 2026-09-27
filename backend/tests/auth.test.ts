import './setup';
import request from 'supertest';
import { createApp } from '../src/app';
import { User } from '../src/models/User';

const app = createApp();

describe('Auth flow', () => {
  const creds = { name: 'Alice', email: 'alice@example.com', password: 'Password1' };

  it('registers a new user and returns access token', async () => {
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeTruthy();
    expect(res.body.data.user.email).toBe(creds.email);
    expect(res.headers['set-cookie']?.some((c: string) => c.startsWith('sync_rt='))).toBe(true);
  });

  it('rejects duplicate registration', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const res = await request(app).post('/api/auth/register').send(creds);
    expect(res.status).toBe(409);
  });

  it('logs in with correct credentials', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: creds.password });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('rejects login with wrong password', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: creds.email, password: 'wrongpass' });
    expect(res.status).toBe(401);
  });

  it('hashes the password (not stored in plain)', async () => {
    await request(app).post('/api/auth/register').send(creds);
    const user = await User.findOne({ email: creds.email }).select('+passwordHash');
    expect(user?.passwordHash).toBeTruthy();
    expect(user?.passwordHash).not.toBe(creds.password);
  });

  it('validates password strength', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Bob', email: 'bob@example.com', password: 'short' });
    expect(res.status).toBe(422);
  });

  it('refreshes the access token using the refresh cookie', async () => {
    const reg = await request(app).post('/api/auth/register').send(creds);
    const cookie = (reg.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('sync_rt='))!;
    const res = await request(app).post('/api/auth/refresh').set('Cookie', cookie).send();
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('protects /me with access token', async () => {
    const reg = await request(app).post('/api/auth/register').send(creds);
    const noAuth = await request(app).get('/api/auth/me');
    expect(noAuth.status).toBe(401);
    const ok = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${reg.body.data.accessToken}`);
    expect(ok.status).toBe(200);
    expect(ok.body.data.email).toBe(creds.email);
  });
});
