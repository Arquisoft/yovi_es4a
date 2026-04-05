import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

process.env.NODE_ENV = 'test'
// process.env.EMAIL_USER = 'test@yovi.com'
// process.env.EMAIL_PASS = 'password_falsa_123'

// vi.mock('nodemailer', () => ({
//   default: {
//     createTransport: () => ({
//       sendMail: async () => ({}), 
//     }),
//   },
//   createTransport: () => ({
//     sendMail: async () => ({}),
//   }),
// }))

let mongod
let User

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  const uri = mongod.getUri()
  await mongoose.connect(uri)
})

afterAll(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
  await mongod.stop()
})

const appModule = await import('../users-service.js')
const app = appModule.default || appModule

async function createVerifiedUser(username, email) {
  await request(app)
    .post('/createuser')
    .send({ username, password: '1234', email })

  const UserModule = await import('../users-model.js')
  User = UserModule.default || UserModule

  await User.updateOne(
    { username },
    {
      $set: {
        isVerified: true,
      },
    }
  )
}

describe('POST /createuser', () => {
  it('returns an error if the user already exists', async () => {
    await request(app)
      .post('/createuser')
      .send({ username: 'Pablo2', password: '1234', email: 'pablo2@test.com' })

    const res = await request(app)
      .post('/createuser')
      .send({ username: 'Pablo2', password: '1234', email: 'pablo2@test.com' })
      .set('Accept', 'application/json')

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/El usuario o el correo ya están en uso/i)
  })
})

describe('POST /login', () => {
  beforeAll(async () => {
    await createVerifiedUser('LoginUser', 'login@test.com')
  })

  it('returns a welcome message for valid credentials', async () => {
    const res = await request(app)
      .post('/login')
      .send({ username: 'LoginUser', password: '1234' })
      .set('Accept', 'application/json')

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/Bienvenido LoginUser/i)
  })

  it('returns an error for incorrect password', async () => {
    const res = await request(app)
      .post('/login')
      .send({ username: 'LoginUser', password: 'wrongpassword' })
      .set('Accept', 'application/json')

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/Contraseña incorrecta/i)
  })

  it('returns an error if the user does not exist', async () => {
    const res = await request(app)
      .post('/login')
      .send({ username: 'NoExiste', password: '1234' })
      .set('Accept', 'application/json')

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/Usuario no encontrado/i)
  })
})

describe('PATCH /users/:username/stats', () => {
  beforeAll(async () => {
    await createVerifiedUser('StatsUser', 'stats@test.com')
  })

  it('increments gamesWon and totalMoves when won=true', async () => {
    const res = await request(app)
      .patch('/users/StatsUser/stats')
      .send({ won: true, totalMoves: 10 })
      .set('Accept', 'application/json')

    expect(res.status).toBe(200)
    expect(res.body.stats.gamesPlayed).toBe(1)
    expect(res.body.stats.gamesWon).toBe(1)
    expect(res.body.stats.gamesLost).toBe(0)
    expect(res.body.stats.totalMoves).toBe(10)
    expect(res.body.stats.winRate).toBe(100)
  })

  it('increments gamesLost and accumulates totalMoves when won=false', async () => {
    const res = await request(app)
      .patch('/users/StatsUser/stats')
      .send({ won: false, totalMoves: 8 })
      .set('Accept', 'application/json')

    expect(res.status).toBe(200)
    expect(res.body.stats.gamesPlayed).toBe(2)
    expect(res.body.stats.gamesWon).toBe(1)
    expect(res.body.stats.gamesLost).toBe(1)
    expect(res.body.stats.totalMoves).toBe(18)
    expect(res.body.stats.winRate).toBe(50)
  })

  it('returns 404 for non-existent user', async () => {
    const res = await request(app)
      .patch('/users/NoExiste/stats')
      .send({ won: true, totalMoves: 5 })

    expect(res.status).toBe(404)
  })

  it('returns 400 if won is not a boolean', async () => {
    const res = await request(app)
      .patch('/users/StatsUser/stats')
      .send({ won: 'yes', totalMoves: 5 })

    expect(res.status).toBe(400)
  })

  it('returns 400 if totalMoves is negative', async () => {
    const res = await request(app)
      .patch('/users/StatsUser/stats')
      .send({ won: true, totalMoves: -1 })

    expect(res.status).toBe(400)
  })
})

describe('GET /ranking', () => {
  beforeAll(async () => {
    await createVerifiedUser('RankA', 'ranka@test.com')
    await createVerifiedUser('RankB', 'rankb@test.com')
    await createVerifiedUser('RankC', 'rankc@test.com')

    // RankA: 3 wins 1 loss → winRate 75%
    await request(app).patch('/users/RankA/stats').send({ won: true, totalMoves: 10 })
    await request(app).patch('/users/RankA/stats').send({ won: true, totalMoves: 8 })
    await request(app).patch('/users/RankA/stats').send({ won: true, totalMoves: 6 })
    await request(app).patch('/users/RankA/stats').send({ won: false, totalMoves: 7 })

    // RankB: 1 win 1 loss → winRate 50%
    await request(app).patch('/users/RankB/stats').send({ won: true, totalMoves: 12 })
    await request(app).patch('/users/RankB/stats').send({ won: false, totalMoves: 12 })

    // RankC: 0 wins 2 losses → winRate 0%
    await request(app).patch('/users/RankC/stats').send({ won: false, totalMoves: 5 })
    await request(app).patch('/users/RankC/stats').send({ won: false, totalMoves: 5 })
  })

  it('returns ranking sorted by winRate by default', async () => {
    const res = await request(app).get('/ranking')

    expect(res.status).toBe(200)
    expect(res.body.sortBy).toBe('winRate')

    const names = res.body.ranking.map(u => u.username)
    expect(names.indexOf('RankA')).toBeLessThan(names.indexOf('RankB'))
    expect(names.indexOf('RankB')).toBeLessThan(names.indexOf('RankC'))
  })

  it('returns ranking sorted by gamesWon', async () => {
    const res = await request(app).get('/ranking?sortBy=gamesWon')

    expect(res.status).toBe(200)

    const ranka = res.body.ranking.find(u => u.username === 'RankA')
    const rankb = res.body.ranking.find(u => u.username === 'RankB')

    expect(ranka.gamesWon).toBeGreaterThan(rankb.gamesWon)
  })

  it('returns ranking sorted by gamesPlayed', async () => {
    const res = await request(app).get('/ranking?sortBy=gamesPlayed')

    expect(res.status).toBe(200)

    const ranka = res.body.ranking.find(u => u.username === 'RankA')
    expect(ranka.gamesPlayed).toBe(4)
  })

  it('ranking entries include totalMoves from all recorded games', async () => {
    const res = await request(app).get('/ranking')

    expect(res.status).toBe(200)

    const ranka = res.body.ranking.find(u => u.username === 'RankA')
    expect(ranka.totalMoves).toBe(31) // 10+8+6+7
  })

  it('respects the limit parameter', async () => {
    const res = await request(app).get('/ranking?limit=1')

    expect(res.status).toBe(200)
    expect(res.body.ranking.length).toBeLessThanOrEqual(1)
  })

  it('ignores users with no games played', async () => {
    await createVerifiedUser('NoGames', 'nogames@test.com')

    const res = await request(app).get('/ranking')
    const names = res.body.ranking.map(u => u.username)

    expect(names).not.toContain('NoGames')
  })
})

describe('GET /users/:username/stats', () => {
  it('returns stats for existing user', async () => {
    const res = await request(app).get('/users/StatsUser/stats')

    expect(res.status).toBe(200)
    expect(res.body.username).toBe('StatsUser')
    expect(res.body.stats).toHaveProperty('gamesPlayed')
    expect(res.body.stats).toHaveProperty('gamesWon')
    expect(res.body.stats).toHaveProperty('gamesLost')
    expect(res.body.stats).toHaveProperty('gamesAbandoned')
    expect(res.body.stats).toHaveProperty('totalMoves')
    expect(res.body.stats).toHaveProperty('winRate')
    expect(res.body.stats).not.toHaveProperty('winningMoves')
    expect(res.body.stats).not.toHaveProperty('accuracy')
  })

  it('returns 404 for non-existent user', async () => {
    const res = await request(app).get('/users/NoExiste/stats')
    expect(res.status).toBe(404)
  })
})