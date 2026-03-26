import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

vi.mock('nodemailer', () => ({
  default: {
    createTransport: () => ({
      sendMail: vi.fn().mockResolvedValue({}),
    }),
  },
  createTransport: () => ({
    sendMail: vi.fn().mockResolvedValue({}),
  }),
}))

let mongod
let User
let api

beforeAll(async () => {
  process.env.NODE_ENV = 'test'
  mongod = await MongoMemoryServer.create()
  const uri = mongod.getUri()
  await mongoose.connect(uri)

  await import('../users-service.js')
  const UserModule = await import('../users-model.js')
  User = UserModule.default || UserModule

  api = request('http://127.0.0.1:8001')
})

afterAll(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
  await mongod.stop()
})

async function createVerifiedUser(username, email) {
  await api
    .post('/createuser')
    .send({ username, password: '1234', email })

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
  it('crea un usuario válido', async () => {
    const res = await api
      .post('/createuser')
      .send({
        username: 'Pablo2',
        password: '1234',
        email: 'pablo2@test.com',
      })
      .set('Accept', 'application/json')

    expect(res.status).toBe(201)
    expect(res.body.message).toMatch(/Bienvenido Pablo2/i)
  })

  it('returns an error if the user already exists', async () => {
    await api
      .post('/createuser')
      .send({ username: 'Pablo2', password: '1234', email: 'pablo2@test.com' })

    const res = await api
      .post('/createuser')
      .send({ username: 'Pablo2', password: '1234', email: 'pablo2@test.com' })
      .set('Accept', 'application/json')

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/El nombre de usuario ya está registrado/i)
  })

  it('devuelve 400 si el username no cumple el formato', async () => {
    const res = await api
      .post('/createuser')
      .send({
        username: '.mal_usuario',
        password: '1234',
        email: 'baduser@test.com',
      })
      .set('Accept', 'application/json')

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/no puede empezar ni terminar/i)
  })
})

describe('POST /login', () => {
  beforeAll(async () => {
    await createVerifiedUser('LoginUser', 'login@test.com')

    await api.post('/createuser').send({
      username: 'NoVerificado',
      password: '1234',
      email: 'noverificado@test.com',
    })
  })

  it('returns a welcome message for valid credentials', async () => {
    const res = await api
      .post('/login')
      .send({ username: 'LoginUser', password: '1234' })
      .set('Accept', 'application/json')

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/Bienvenido LoginUser/i)
    expect(res.body.username).toBe('LoginUser')
  })

  it('returns an error for incorrect password', async () => {
    const res = await api
      .post('/login')
      .send({ username: 'LoginUser', password: 'wrongpassword' })
      .set('Accept', 'application/json')

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/Contraseña incorrecta/i)
  })

  it('returns an error if the user does not exist', async () => {
    const res = await api
      .post('/login')
      .send({ username: 'NoExiste', password: '1234' })
      .set('Accept', 'application/json')

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/Usuario no encontrado/i)
  })

  it('devuelve error si el usuario no verificó el correo', async () => {
    const res = await api
      .post('/login')
      .send({ username: 'NoVerificado', password: '1234' })
      .set('Accept', 'application/json')

    expect(res.status).toBe(403)
    expect(res.body.error).toMatch(/verifica tu correo electrónico/i)
  })

  it('devuelve 400 si el username es inválido', async () => {
    const res = await api
      .post('/login')
      .send({ username: '..', password: '1234' })
      .set('Accept', 'application/json')

    expect(res.status).toBe(400)
  })
})

describe('POST /users/:username/games', () => {
  beforeAll(async () => {
    await createVerifiedUser('GameUser', 'games@test.com')
  })

  it('registra una partida y actualiza estadísticas', async () => {
    const res = await api
      .post('/users/GameUser/games')
      .send({
        gameId: 'game-1',
        mode: 'HvB',
        result: 'won',
        boardSize: 7,
        totalMoves: 10,
        opponent: 'random_bot',
        startedBy: 'human',
      })
      .set('Accept', 'application/json')

    expect(res.status).toBe(201)
    expect(res.body.username).toBe('GameUser')
    expect(res.body.stats.gamesPlayed).toBe(1)
    expect(res.body.stats.gamesWon).toBe(1)
    expect(res.body.stats.gamesLost).toBe(0)
    expect(res.body.stats.gamesAbandoned).toBe(0)
    expect(res.body.stats.totalMoves).toBe(10)
    expect(res.body.stats.winRate).toBe(100)
    expect(res.body.savedGame.gameId).toBe('game-1')
  })

  it('devuelve 409 si la misma partida ya fue registrada', async () => {
    const res = await api
      .post('/users/GameUser/games')
      .send({
        gameId: 'game-1',
        mode: 'HvB',
        result: 'won',
        boardSize: 7,
        totalMoves: 10,
        opponent: 'random_bot',
        startedBy: 'human',
      })
      .set('Accept', 'application/json')

    expect(res.status).toBe(409)
    expect(res.body.error).toMatch(/ya fue registrada/i)
  })

  it('devuelve 400 si el body no es válido', async () => {
    const res = await api
      .post('/users/GameUser/games')
      .send({
        gameId: '',
        mode: 'modo-raro',
        result: 'won',
        boardSize: -1,
        totalMoves: -2,
      })
      .set('Accept', 'application/json')

    expect(res.status).toBe(400)
    expect(res.body.error).toBeTruthy()
  })
})

describe('GET /users/:username/history', () => {
  beforeAll(async () => {
    await createVerifiedUser('HistoryUser', 'history@test.com')

    await api.post('/users/HistoryUser/games').send({
      gameId: 'h1',
      mode: 'HvB',
      result: 'won',
      boardSize: 7,
      totalMoves: 8,
      opponent: 'bot_a',
      startedBy: 'human',
    })

    await api.post('/users/HistoryUser/games').send({
      gameId: 'h2',
      mode: 'HvH',
      result: 'lost',
      boardSize: 9,
      totalMoves: 14,
      opponent: 'Jugador local',
      startedBy: 'player0',
    })

    await api.post('/users/HistoryUser/games').send({
      gameId: 'h3',
      mode: 'HvB',
      result: 'won',
      boardSize: 11,
      totalMoves: 5,
      opponent: 'bot_b',
      startedBy: 'bot',
    })
  })

  it('devuelve historial paginado con stats', async () => {
    const res = await api.get('/users/HistoryUser/history?page=1&pageSize=2')

    expect(res.status).toBe(200)
    expect(res.body.username).toBe('HistoryUser')
    expect(res.body.stats.gamesPlayed).toBe(3)
    expect(res.body.pagination.page).toBe(1)
    expect(res.body.pagination.pageSize).toBe(2)
    expect(res.body.pagination.totalGames).toBe(3)
    expect(res.body.pagination.totalPages).toBe(2)
    expect(res.body.games).toHaveLength(2)
  })

  it('filtra por modo y resultado', async () => {
    const res = await api.get(
      '/users/HistoryUser/history?page=1&pageSize=10&mode=HvB&result=won'
    )

    expect(res.status).toBe(200)
    expect(res.body.games).toHaveLength(2)
    expect(res.body.games.every((g) => g.mode === 'HvB')).toBe(true)
    expect(res.body.games.every((g) => g.result === 'won')).toBe(true)
  })

  it('ordena por movimientos descendentes', async () => {
    const res = await api.get(
      '/users/HistoryUser/history?page=1&pageSize=10&sortBy=movesDesc'
    )

    expect(res.status).toBe(200)
    expect(res.body.games[0].totalMoves).toBeGreaterThanOrEqual(
      res.body.games[1].totalMoves
    )
    expect(res.body.games[1].totalMoves).toBeGreaterThanOrEqual(
      res.body.games[2].totalMoves
    )
  })

  it('devuelve 404 si el usuario no existe', async () => {
    const res = await api.get('/users/NoExiste/history')
    expect(res.status).toBe(404)
  })
})

describe('PATCH /users/:username/stats', () => {
  beforeAll(async () => {
    await createVerifiedUser('StatsUser', 'stats@test.com')
  })

  it('increments gamesWon and totalMoves when won=true', async () => {
    const res = await api
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
    const res = await api
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
    const res = await api
      .patch('/users/NoExiste/stats')
      .send({ won: true, totalMoves: 5 })

    expect(res.status).toBe(404)
  })

  it('returns 400 if won is not a boolean', async () => {
    const res = await api
      .patch('/users/StatsUser/stats')
      .send({ won: 'yes', totalMoves: 5 })

    expect(res.status).toBe(400)
  })

  it('returns 400 if totalMoves is negative', async () => {
    const res = await api
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

    await api.patch('/users/RankA/stats').send({ won: true, totalMoves: 10 })
    await api.patch('/users/RankA/stats').send({ won: true, totalMoves: 8 })
    await api.patch('/users/RankA/stats').send({ won: true, totalMoves: 6 })
    await api.patch('/users/RankA/stats').send({ won: false, totalMoves: 7 })

    await api.patch('/users/RankB/stats').send({ won: true, totalMoves: 12 })
    await api.patch('/users/RankB/stats').send({ won: false, totalMoves: 12 })

    await api.patch('/users/RankC/stats').send({ won: false, totalMoves: 5 })
    await api.patch('/users/RankC/stats').send({ won: false, totalMoves: 5 })
  })

  it('returns ranking sorted by winRate by default', async () => {
    const res = await api.get('/ranking')

    expect(res.status).toBe(200)
    expect(res.body.sortBy).toBe('winRate')

    const names = res.body.ranking.map(u => u.username)
    expect(names.indexOf('RankA')).toBeLessThan(names.indexOf('RankB'))
    expect(names.indexOf('RankB')).toBeLessThan(names.indexOf('RankC'))
  })

  it('returns ranking sorted by gamesWon', async () => {
    const res = await api.get('/ranking?sortBy=gamesWon')

    expect(res.status).toBe(200)

    const ranka = res.body.ranking.find(u => u.username === 'RankA')
    const rankb = res.body.ranking.find(u => u.username === 'RankB')

    expect(ranka.gamesWon).toBeGreaterThan(rankb.gamesWon)
  })

  it('returns ranking sorted by gamesPlayed', async () => {
    const res = await api.get('/ranking?sortBy=gamesPlayed')

    expect(res.status).toBe(200)

    const ranka = res.body.ranking.find(u => u.username === 'RankA')
    expect(ranka.gamesPlayed).toBe(4)
  })

  it('ranking entries include totalMoves from all recorded games', async () => {
    const res = await api.get('/ranking')

    expect(res.status).toBe(200)

    const ranka = res.body.ranking.find(u => u.username === 'RankA')
    expect(ranka.totalMoves).toBe(31) // 10+8+6+7
  })

  it('respects the limit parameter', async () => {
    const res = await api.get('/ranking?limit=1')

    expect(res.status).toBe(200)
    expect(res.body.ranking.length).toBeLessThanOrEqual(1)
  })

  it('ignores users with no games played', async () => {
    await createVerifiedUser('NoGames', 'nogames@test.com')

    const res = await api.get('/ranking')
    const names = res.body.ranking.map(u => u.username)

    expect(names).not.toContain('NoGames')
  })
})

describe('GET /users/:username/stats', () => {
  it('returns stats for existing user', async () => {
    const res = await api.get('/users/StatsUser/stats')

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
    const res = await api.get('/users/NoExiste/stats')
    expect(res.status).toBe(404)
  })
})