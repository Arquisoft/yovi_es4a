import { describe, it, expect, afterEach, vi } from 'vitest'
import request from 'supertest'

vi.mock('mongoose', () => ({
    default: {
        connect: vi.fn().mockResolvedValue(true),
        model: vi.fn(),
        Schema: vi.fn().mockImplementation(() => ({}))
    }
}))

vi.mock('../users-model.js', () => ({
    default: vi.fn().mockImplementation(() => ({
        save: vi.fn().mockResolvedValue(true)
    }))
}))

const app = (await import('../users-service.js')).default

describe('POST /createuser', () => {
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('returns a greeting message for the provided username', async () => {
        const res = await request(app)
            .post('/createuser')
            .send({ username: 'Prueba1234', password: '1234' })
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        expect(res.body).toHaveProperty('message')
        expect(res.body.message).toMatch(/Bienvenido Prueba1234/i)
    })
})