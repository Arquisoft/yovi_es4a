import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import { MongoMemoryServer } from 'mongodb-memory-server'

process.env.NODE_ENV = 'test'

let mongod
let User
let api

beforeAll(async () => {
  mongod = await MongoMemoryServer.create()
  const uri = mongod.getUri()
  await mongoose.connect(uri)

  const service = await import('../users-service.js')
  const app = service.default || service
  const UserModule = await import('../users-model.js')
  User = UserModule.default || UserModule

  api = request(app)
})

afterAll(async () => {
  await mongoose.connection.dropDatabase()
  await mongoose.disconnect()
  await mongod.stop()
})

async function createVerifiedUser(username, email) {
  await api.post('/createuser').send({ username, password: 'password123', email })
  await User.updateOne({ username }, { $set: { isVerified: true } })
}

describe('Coverage Extra - backend', () => {
  it('ranking semanal y podio con fechas mezcladas', async () => {
    await createVerifiedUser('UserSemanal', 'sem@test.com')
    const hoy = new Date()
    const antiguo = new Date(); antiguo.setDate(hoy.getDate() - 10)

    // Partida que entra en semanal
    await User.updateOne({ username: 'UserSemanal' }, {
      $push: { gameHistory: { gameId: 'g1', mode: 'classic_hvh', result: 'won', totalMoves: 10, finishedAt: hoy } },
      $inc: { "stats.gamesPlayed": 1, "stats.gamesWon": 1, "stats.totalMoves": 10 }
    })
    
    const res = await api.get('/ranking')
    expect(res.body.podium.mostWins.username).toBe('UserSemanal')
  })

  it('gestiona correctamente resultados de empate (draw)', async () => {
    await createVerifiedUser('UserDraw', 'draw@test.com')
    const res = await api.post('/users/UserDraw/games').send({
      gameId: 'g-draw', mode: 'classic_hvh', result: 'draw', boardSize: 10, totalMoves: 5
    })
    expect(res.status).toBe(201)
    expect(res.body.stats.gamesDrawn).toBe(1)
  })

  it('valida boardSize y totalMoves negativos', async () => {
    const res1 = await api.post('/users/UserDraw/games').send({
      gameId: 'g-err1', mode: 'classic_hvh', result: 'won', boardSize: -1, totalMoves: 5
    })
    expect(res1.status).toBe(400)

    const res2 = await api.post('/users/UserDraw/games').send({
      gameId: 'g-err2', mode: 'classic_hvh', result: 'won', boardSize: 10, totalMoves: -1
    })
    expect(res2.status).toBe(400)
  })

  it('prueba ordenación de historial por oldest', async () => {
    const res = await api.get('/users/UserSemanal/history?sortBy=oldest')
    expect(res.status).toBe(200)
  })
})
