import './setup';
import request from 'supertest';

// Mock Cloudinary so tests don't hit the network. We capture upload_stream calls
// and synthesize a fake remote URL/publicId.
jest.mock('../src/config/cloudinary', () => {
  return {
    getCloudinary: () => ({
      uploader: {
        upload_stream: (_opts: unknown, cb: (err: Error | null, res: unknown) => void) => {
          let chunks = 0;
          return {
            end: (buf: Buffer) => {
              chunks = buf.length;
              cb(null, {
                secure_url: `https://res.cloudinary.test/sync/fake-${Date.now()}.bin`,
                public_id: `sync/fake-${Date.now()}`,
                bytes: chunks,
              });
            },
          };
        },
        destroy: async () => ({ result: 'ok' }),
      },
      utils: {
        private_download_url: (publicId: string) => `https://res.cloudinary.test/${publicId}?signed=1`,
      },
    }),
  };
});

import { createApp } from '../src/app';

const app = createApp();

describe('File upload', () => {
  it('uploads an image and attaches it to a task', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      name: 'Owner', email: 'owner@example.com', password: 'Password1',
    });
    const token = reg.body.data.accessToken as string;
    const proj = await request(app).post('/api/projects')
      .set('Authorization', `Bearer ${token}`).send({ name: 'Files' });
    const projectId = proj.body.data._id as string;
    const t = await request(app).post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${token}`).send({ title: 'With file' });
    const taskId = t.body.data._id as string;

    const png = Buffer.from('89504E470D0A1A0A0000000D49484452', 'hex'); // minimal PNG header
    const res = await request(app)
      .post(`/api/projects/${projectId}/files`)
      .set('Authorization', `Bearer ${token}`)
      .field('taskId', taskId)
      .attach('file', png, { filename: 'tiny.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.data.filename).toBe('tiny.png');
    expect(res.body.data.task).toBe(taskId);
  });

  it('rejects disallowed mime types', async () => {
    const reg = await request(app).post('/api/auth/register').send({
      name: 'O', email: 'o@example.com', password: 'Password1',
    });
    const token = reg.body.data.accessToken as string;
    const proj = await request(app).post('/api/projects')
      .set('Authorization', `Bearer ${token}`).send({ name: 'P' });

    const res = await request(app)
      .post(`/api/projects/${proj.body.data._id}/files`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from('binary'), { filename: 'hack.exe', contentType: 'application/x-msdownload' });

    expect(res.status).toBe(400);
  });
});
