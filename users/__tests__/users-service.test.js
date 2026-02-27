import { describe, it, expect, afterEach, vi } from 'vitest'
import request from 'supertest'

vi.mock('mongoose', async () => {
    const actual = await vi.importActual('mongoose');
    return {
        ...actual,
        connect: vi.fn().mockResolvedValue(true),
    };
});

vi.mock('../user-model.js', () => {
    const User = vi.fn().mockImplementation(() => ({
        save: vi.fn().mockResolvedValue(true)
    }));
    User.findOne = vi.fn();
    return { default: User };
});

import app from '../users-service.js'

describe('POST /createuser', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('returns a greeting message for the provided username', async () => {
        const res = await request(app)
            .post('/createuser')
            .send({ username: 'Pablo', password: '1234' })
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        expect(res.body).toHaveProperty('message')
        expect(res.body.message).toMatch(/Bienvenido Pablo/i)
    })
})