import './setup';
import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

async function bootstrap() {
  const userA = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Owner', email: 'owner@example.com', password: 'Password1' });
  const project = await request(app)
    .post('/api/projects')
    .set('Authorization', `Bearer ${userA.body.data.accessToken}`)
    .send({ name: 'Test project', description: 'desc' });
  return {
    token: userA.body.data.accessToken as string,
    projectId: project.body.data._id as string,
  };
}

describe('Task CRUD', () => {
  it('creates, lists, updates and deletes a task', async () => {
    const { token, projectId } = await bootstrap();

    const create = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'My task', priority: 'high' });
    expect(create.status).toBe(201);
    const taskId = create.body.data._id as string;
    expect(create.body.data.version).toBe(0);

    const list = await request(app)
      .get(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(1);

    const update = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'in_progress', expectedVersion: 0 });
    expect(update.status).toBe(200);
    expect(update.body.data.version).toBe(1);
    expect(update.body.data.status).toBe('in_progress');

    const conflict = await request(app)
      .patch(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed', expectedVersion: 0 });
    expect(conflict.status).toBe(409);

    const del = await request(app)
      .delete(`/api/projects/${projectId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(204);
  });

  it('filters by status and priority', async () => {
    const { token, projectId } = await bootstrap();
    await request(app).post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${token}`).send({ title: 'A', status: 'todo', priority: 'low' });
    await request(app).post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${token}`).send({ title: 'B', status: 'in_progress', priority: 'critical' });

    const res = await request(app)
      .get(`/api/projects/${projectId}/tasks?status=in_progress`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].title).toBe('B');
  });

  it('rejects task creation for non-members', async () => {
    const { projectId } = await bootstrap();
    const intruder = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Eve', email: 'eve@example.com', password: 'Password1' });
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks`)
      .set('Authorization', `Bearer ${intruder.body.data.accessToken}`)
      .send({ title: 'sneaky' });
    expect(res.status).toBe(403);
  });

  it('supports bulk status update', async () => {
    const { token, projectId } = await bootstrap();
    const ids = await Promise.all(
      [1, 2, 3].map(async (i) => {
        const r = await request(app).post(`/api/projects/${projectId}/tasks`)
          .set('Authorization', `Bearer ${token}`).send({ title: `T${i}` });
        return r.body.data._id as string;
      }),
    );
    const res = await request(app)
      .post(`/api/projects/${projectId}/tasks/bulk-update`)
      .set('Authorization', `Bearer ${token}`)
      .send({ taskIds: ids, patch: { status: 'completed' } });
    expect(res.status).toBe(200);
    expect(res.body.data.modified).toBe(3);
  });
});
