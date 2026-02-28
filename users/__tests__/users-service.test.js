import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

let mongod;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    await mongoose.connect(uri);
});

afterAll(async () => {
    await mongoose.disconnect();
    await mongod.stop();
});

afterEach(async () => {
    await mongoose.connection.dropDatabase();
});

const app = (await import('../users-service.js')).default

describe('POST /createuser', () => {
    it('returns a greeting message for the provided username', async () => {
        const res = await request(app)
            .post('/createuser')
            .send({ username: 'Pablo', password: '1234' })
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        expect(res.body).toHaveProperty('message')
        expect(res.body.message).toMatch(/Bienvenido Pablo/i)
    })

    it('returns an error if the user already exists', async () => {
        await request(app)
            .post('/createuser')
            .send({ username: 'Pablo', password: '1234' })

        const res = await request(app)
            .post('/createuser')
            .send({ username: 'Pablo', password: '1234' })
            .set('Accept', 'application/json')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(res.body.error).toMatch(/El usuario ya existe/i)
    })
})

describe('POST /login', () => {
    beforeAll(async () => {
        await request(app)
            .post('/createuser')
            .send({ username: 'Pablo', password: '1234' })
    })

    it('returns a welcome message for valid credentials', async () => {
        const res = await request(app)
            .post('/login')
            .send({ username: 'Pablo', password: '1234' })
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        expect(res.body).toHaveProperty('message')
        expect(res.body.message).toMatch(/Bienvenido Pablo/i)
    })

    it('returns an error for incorrect password', async () => {
        const res = await request(app)
            .post('/login')
            .send({ username: 'Pablo', password: 'wrongpassword' })
            .set('Accept', 'application/json')

        expect(res.status).toBe(401)
        expect(res.body).toHaveProperty('error')
        expect(res.body.error).toMatch(/Contraseña incorrecta/i)
    })

    it('returns an error if the user does not exist', async () => {
        const res = await request(app)
            .post('/login')
            .send({ username: 'NoExiste', password: '1234' })
            .set('Accept', 'application/json')

        expect(res.status).toBe(401)
        expect(res.body).toHaveProperty('error')
        expect(res.body.error).toMatch(/Usuario no encontrado/i)
    })
})