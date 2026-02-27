import { describe, it, expect, afterEach, beforeAll, vi } from 'vitest'

vi.mock('mongoose', async () => {
    const actual = await vi.importActual('mongoose');
    return { ...actual, connect: vi.fn().mockResolvedValue(true) };
});

vi.mock('bcrypt', () => ({
    default: {
        hash: vi.fn().mockResolvedValue('hashedpassword'),
        compare: vi.fn().mockResolvedValue(true),
    }
}));

vi.mock('../user-model.js', () => {
    const User = vi.fn().mockImplementation(() => ({
        save: vi.fn().mockResolvedValue(true)
    }));
    User.findOne = vi.fn();
    return { default: User };
});

let app;
beforeAll(async () => {
    app = (await import('../users-service.js')).default;
});

describe('POST /createuser', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('returns a greeting message for the provided username', async () => {
        const { default: request } = await import('supertest');
        const res = await request(app)
            .post('/createuser')
            .send({ username: 'Pablo', password: '1234' })
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        expect(res.body).toHaveProperty('message')
        expect(res.body.message).toMatch(/Bienvenido Pablo/i)
    })
})