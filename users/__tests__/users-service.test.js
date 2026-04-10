import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
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
    expect(res.body.error).toMatch(/El usuario o el correo ya están en uso/i)
  })

  it('devuelve 400 si falta la contraseña (error interno atrapado)', async () => {
    const res = await api
      .post('/createuser')
      .send({ username: 'SinPass', email: 'sinpass@test.com' }) // Falta la password
    expect(res.status).toBe(400)
  })

  it('devuelve 500 y borra el usuario si falla el envío de correo', async () => {
    // Guardamos estado original
    const oldEnv = process.env.NODE_ENV;
    const oldEmail = process.env.EMAIL_USER;
    
    // Forzamos fallo: Le decimos al backend que no está en test, pero le quitamos las credenciales de email
    process.env.NODE_ENV = 'development';
    delete process.env.EMAIL_USER;

    const res = await api
      .post('/createuser')
      .send({ username: 'FalloCorreo', password: '123', email: 'fallo@test.com' })

    expect(res.status).toBe(500)
    expect(res.body.error).toMatch(/problema al enviar el correo/i)

    // Restauramos estado
    process.env.NODE_ENV = oldEnv;
    process.env.EMAIL_USER = oldEmail;
  })
})

describe('Validaciones de formato de usuario', () => {
  it('devuelve 400 si el username no es un string', async () => {
    const res = await api
      .post('/createuser')
      .send({ username: 12345, password: '123', email: 'num@test.com' })
    expect(res.status).toBe(400)
  })

  it('devuelve 400 si el username tiene menos de 3 caracteres', async () => {
    const res = await api
      .post('/createuser')
      .send({ username: 'ab', password: '123', email: 'ab@test.com' })
    
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/al menos 3 caracteres/i)
  })

  it('devuelve 400 si el username tiene más de 20 caracteres', async () => {
    const res = await api
      .post('/createuser')
      .send({ username: 'usuario_extremadamente_largo', password: '123', email: 'largo@test.com' })
    
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/exceder los 20 caracteres/i)
  })

  it('devuelve 400 si falta el username', async () => {
    const res = await api
      .post('/createuser')
      .send({ password: '123', email: 'falta@test.com' })
    
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/obligatorio/i)
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

  it('devuelve 400 si no se envía la contraseña', async () => {
    const res = await api
      .post('/login')
      .send({ username: 'LoginUser' }) // Solo enviamos el usuario
      .set('Accept', 'application/json')

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/La contraseña es obligatoria/i)
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
        mode: 'classic_hvb',
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
    expect(res.body.savedGame.mode).toBe('classic_hvb')
  })

  it('devuelve 409 si la misma partida ya fue registrada', async () => {
    const res = await api
      .post('/users/GameUser/games')
      .send({
        gameId: 'game-1',
        mode: 'classic_hvb',
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

  it('acepta modos nuevos como fortune_dice_hvh', async () => {
    const res = await api
      .post('/users/GameUser/games')
      .send({
        gameId: 'game-2',
        mode: 'fortune_dice_hvh',
        result: 'lost',
        boardSize: 9,
        totalMoves: 14,
        opponent: 'Jugador local',
        startedBy: 'player0',
      })
      .set('Accept', 'application/json')

    expect(res.status).toBe(201)
    expect(res.body.savedGame.mode).toBe('fortune_dice_hvh')
  })

  it('acepta modos nuevos como poly_hvh', async () => {
    const res = await api
      .post('/users/GameUser/games')
      .send({
        gameId: 'game-3',
        mode: 'poly_hvh',
        result: 'abandoned',
        boardSize: 11,
        totalMoves: 7,
        opponent: 'Jugador local',
        startedBy: 'player1',
      })
      .set('Accept', 'application/json')

    expect(res.status).toBe(201)
    expect(res.body.savedGame.mode).toBe('poly_hvh')
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

  it('registra una partida como abandonada', async () => {
    const res = await api
      .post('/users/GameUser/games')
      .send({
        gameId: 'game-abandoned-test',
        mode: 'classic_hvb',
        result: 'abandoned',
        boardSize: 7,
        totalMoves: 2
      })

    expect(res.status).toBe(201)
    expect(res.body.stats.gamesAbandoned).toBeGreaterThanOrEqual(1)
  })
})

describe('GET /users/:username/history', () => {
  beforeAll(async () => {
    await createVerifiedUser('HistoryUser', 'history@test.com')

    await api.post('/users/HistoryUser/games').send({
      gameId: 'h1',
      mode: 'classic_hvb',
      result: 'won',
      boardSize: 7,
      totalMoves: 8,
      opponent: 'bot_a',
      startedBy: 'human',
    })

    await api.post('/users/HistoryUser/games').send({
      gameId: 'h2',
      mode: 'classic_hvh',
      result: 'lost',
      boardSize: 9,
      totalMoves: 14,
      opponent: 'Jugador local',
      startedBy: 'player0',
    })

    await api.post('/users/HistoryUser/games').send({
      gameId: 'h3',
      mode: 'classic_hvb',
      result: 'won',
      boardSize: 11,
      totalMoves: 5,
      opponent: 'bot_b',
      startedBy: 'bot',
    })

    await api.post('/users/HistoryUser/games').send({
      gameId: 'h4',
      mode: 'fortune_dice_hvh',
      result: 'abandoned',
      boardSize: 9,
      totalMoves: 6,
      opponent: 'Jugador local',
      startedBy: 'player1',
    })
  })

  it('devuelve historial paginado con stats', async () => {
    const res = await api.get('/users/HistoryUser/history?page=1&pageSize=2')

    expect(res.status).toBe(200)
    expect(res.body.username).toBe('HistoryUser')
    expect(res.body.stats.gamesPlayed).toBe(4)
    expect(res.body.pagination.page).toBe(1)
    expect(res.body.pagination.pageSize).toBe(2)
    expect(res.body.pagination.totalGames).toBe(4)
    expect(res.body.pagination.totalPages).toBe(2)
    expect(res.body.games).toHaveLength(2)
  })

  it('filtra por modo y resultado', async () => {
    const res = await api.get(
      '/users/HistoryUser/history?page=1&pageSize=10&mode=classic_hvb&result=won'
    )

    expect(res.status).toBe(200)
    expect(res.body.games).toHaveLength(2)
    expect(res.body.games.every((g) => g.mode === 'classic_hvb')).toBe(true)
    expect(res.body.games.every((g) => g.result === 'won')).toBe(true)
  })

  it('filtra también por uno de los modos nuevos', async () => {
    const res = await api.get(
      '/users/HistoryUser/history?page=1&pageSize=10&mode=fortune_dice_hvh'
    )

    expect(res.status).toBe(200)
    expect(res.body.games).toHaveLength(1)
    expect(res.body.games[0].mode).toBe('fortune_dice_hvh')
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

  it('usa valores por defecto si page o pageSize son inválidos', async () => {
    const res = await api.get('/users/HistoryUser/history?page=-1&pageSize=abc')
    expect(res.status).toBe(200)
    expect(res.body.pagination.page).toBe(1)
    expect(res.body.pagination.pageSize).toBe(5) // Usa el límite por defecto
  })

  it('ordena por oldest y movesAsc', async () => {
    const resAsc = await api.get('/users/HistoryUser/history?page=1&pageSize=10&sortBy=movesAsc')
    expect(resAsc.status).toBe(200)
    expect(resAsc.body.games[0].totalMoves).toBeLessThanOrEqual(resAsc.body.games[1].totalMoves)

    const resOld = await api.get('/users/HistoryUser/history?page=1&pageSize=10&sortBy=oldest')
    expect(resOld.status).toBe(200)
  })

  it('devuelve paginación correcta cuando el usuario no tiene partidas', async () => {
    await createVerifiedUser('HistoryEmpty', 'emptyhistory@test.com')
    const res = await api.get('/users/HistoryEmpty/history')
    expect(res.status).toBe(200)
    expect(res.body.pagination.totalGames).toBe(0)
    expect(res.body.pagination.totalPages).toBe(1)
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
    expect(ranka.totalMoves).toBe(31)
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

  it('ignora campos sortBy no válidos y usa winRate por defecto', async () => {
    const res = await api.get('/ranking?sortBy=INVENTADO')
    expect(res.status).toBe(200)
    expect(res.body.sortBy).toBe('winRate')
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

describe('GET /verify', () => {
  it('devuelve 400 si el token es inválido o no existe', async () => {
    const res = await api.get('/verify?token=token_inventado_123')

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Token inválido o expirado/i)
  })
})

describe('POST /users/:username/games - Validaciones', () => {
  it('devuelve 400 si el modo de juego no es válido', async () => {
    const res = await api
      .post('/users/StatsUser/games') 
      .send({ gameId: 'g1', mode: 'MODO_INVENTADO', result: 'won', boardSize: 10, totalMoves: 5 })
    
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/'mode' debe ser/i)
  })

  it('devuelve 400 si el tamaño del tablero es inválido', async () => {
    const res = await api
      .post('/users/StatsUser/games')
      .send({ gameId: 'g2', mode: 'classic_hvb', result: 'won', boardSize: -5, totalMoves: 5 })
    
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/'boardSize' debe ser un número positivo/i)
  })
  
  it('devuelve 400 si falta el gameId', async () => {
    const res = await api
      .post('/users/StatsUser/games')
      .send({ mode: 'classic_hvb', result: 'won', boardSize: 10, totalMoves: 5 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/'gameId' es obligatorio/i)
  })

  it('devuelve 400 si el gameId supera los 100 caracteres', async () => {
    const res = await api
      .post('/users/StatsUser/games')
      .send({ gameId: 'a'.repeat(101), mode: 'classic_hvb', result: 'won', boardSize: 10, totalMoves: 5 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/no puede exceder los 100 caracteres/i)
  })

  it('devuelve 400 si el resultado no es válido', async () => {
    const res = await api
      .post('/users/StatsUser/games')
      .send({ gameId: 'g-invalido', mode: 'classic_hvb', result: 'empate', boardSize: 10, totalMoves: 5 })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/'result' debe ser/i)
  })

  it('devuelve 404 si se intenta registrar partida a un usuario que no existe', async () => {
    const res = await api
      .post('/users/UserFantasma123/games')
      .send({ gameId: 'g-fantasma', mode: 'classic_hvb', result: 'won', boardSize: 10, totalMoves: 5 })
    expect(res.status).toBe(404)
  })
})

describe('CORS OPTIONS', () => {
  it('devuelve 204 para peticiones OPTIONS', async () => {
    const res = await api.options('/login')
    expect(res.status).toBe(204)
  })
})

describe('GET /users/:username/profile', () => {
  beforeAll(async () => {
    await createVerifiedUser('ProfileUser', 'profileuser@test.com')
  })

  it('devuelve username, email y profilePicture del usuario', async () => {
    const res = await api.get('/users/ProfileUser/profile')

    expect(res.status).toBe(200)
    expect(res.body.username).toBe('ProfileUser')
    expect(res.body.email).toBe('profileuser@test.com')
    expect(res.body).toHaveProperty('profilePicture')
  })

  it('devuelve 404 si el usuario no existe', async () => {
    const res = await api.get('/users/UsuarioFantasma999/profile')

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/Usuario no encontrado/i)
  })

  it('devuelve 400 si el username es inválido', async () => {
    const res = await api.get('/users/../profile')

    expect(res.status).toBe(400)
  })

  it('no devuelve la contraseña en la respuesta', async () => {
    const res = await api.get('/users/ProfileUser/profile')

    expect(res.status).toBe(200)
    expect(res.body).not.toHaveProperty('password')
  })
})

describe('PUT /users/:username/password', () => {
  beforeAll(async () => {
    await createVerifiedUser('PassUser', 'passuser@test.com')
  })

  it('cambia la contraseña correctamente con credenciales válidas', async () => {
    const res = await api
      .put('/users/PassUser/password')
      .send({ oldPassword: '1234', newPassword: 'NuevaPass123!' })

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/actualizada correctamente/i)
  })

  it('permite iniciar sesión con la nueva contraseña tras el cambio', async () => {
    await api
      .put('/users/PassUser/password')
      .send({ oldPassword: '1234', newPassword: 'PasswordNuevo1!' })

    const login = await api
      .post('/login')
      .send({ username: 'PassUser', password: 'PasswordNuevo1!' })

    expect(login.status).toBe(200)
    expect(login.body.username).toBe('PassUser')
  })

  it('devuelve 401 si la contraseña actual es incorrecta', async () => {
    const res = await api
      .put('/users/PassUser/password')
      .send({ oldPassword: 'contraseña_incorrecta', newPassword: 'NuevaPass123!' })

    expect(res.status).toBe(401)
    expect(res.body.error).toMatch(/contraseña actual es incorrecta/i)
  })

  it('devuelve 400 si falta la contraseña actual', async () => {
    const res = await api
      .put('/users/PassUser/password')
      .send({ newPassword: 'NuevaPass123!' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/contraseña actual es obligatoria/i)
  })

  it('devuelve 400 si la nueva contraseña tiene menos de 6 caracteres', async () => {
    const res = await api
      .put('/users/PassUser/password')
      .send({ oldPassword: '1234', newPassword: 'abc' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/al menos 6 caracteres/i)
  })

  it('devuelve 400 si falta la nueva contraseña', async () => {
    const res = await api
      .put('/users/PassUser/password')
      .send({ oldPassword: '1234' })

    expect(res.status).toBe(400)
  })

  it('devuelve 404 si el usuario no existe', async () => {
    const res = await api
      .put('/users/UsuarioFantasma999/password')
      .send({ oldPassword: '1234', newPassword: 'NuevaPass123!' })

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/Usuario no encontrado/i)
  })

  it('devuelve 400 si el username es inválido', async () => {
    const res = await api
      .put('/users/../password')
      .send({ oldPassword: '1234', newPassword: 'NuevaPass123!' })

    expect(res.status).toBe(400)
  })
})

describe('PATCH /users/:username/username', () => {
  beforeAll(async () => {
    await createVerifiedUser('UsernameOld', 'usernameold@test.com')
    await createVerifiedUser('UsernameOcupado', 'usernameocupado@test.com')
  })

  it('cambia el nombre de usuario correctamente', async () => {
    const res = await api
      .patch('/users/UsernameOld/username')
      .send({ newUsername: 'UsernameNew' })

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/actualizado correctamente/i)
    expect(res.body.username).toBe('UsernameNew')
  })

  it('el usuario es accesible con el nuevo nombre tras el cambio', async () => {
    const res = await api.get('/users/UsernameNew/profile')

    expect(res.status).toBe(200)
    expect(res.body.username).toBe('UsernameNew')
  })

  it('el usuario antiguo ya no existe tras el cambio', async () => {
    const res = await api.get('/users/UsernameOld/profile')

    expect(res.status).toBe(404)
  })

  it('devuelve 400 si el nuevo username ya está en uso', async () => {
    await createVerifiedUser('UsernameConflicto', 'usernameconflicto@test.com')

    const res = await api
      .patch('/users/UsernameConflicto/username')
      .send({ newUsername: 'UsernameOcupado' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/ya está en uso/i)
  })

  it('devuelve 400 si el nuevo username es igual al actual', async () => {
    const res = await api
      .patch('/users/UsernameNew/username')
      .send({ newUsername: 'UsernameNew' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/diferente al actual/i)
  })

  it('devuelve 400 si el nuevo username tiene menos de 3 caracteres', async () => {
    const res = await api
      .patch('/users/UsernameNew/username')
      .send({ newUsername: 'ab' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/al menos 3 caracteres/i)
  })

  it('devuelve 400 si el nuevo username tiene más de 20 caracteres', async () => {
    const res = await api
      .patch('/users/UsernameNew/username')
      .send({ newUsername: 'nombre_demasiado_largo_para_ser_valido' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/exceder los 20 caracteres/i)
  })

  it('devuelve 400 si el nuevo username tiene caracteres inválidos', async () => {
    const res = await api
      .patch('/users/UsernameNew/username')
      .send({ newUsername: 'nombre con espacios' })

    expect(res.status).toBe(400)
  })

  it('devuelve 400 si falta el nuevo username en el body', async () => {
    const res = await api
      .patch('/users/UsernameNew/username')
      .send({})

    expect(res.status).toBe(400)
  })

  it('devuelve 404 si el usuario no existe', async () => {
    const res = await api
      .patch('/users/UsuarioFantasma999/username')
      .send({ newUsername: 'NuevoNombre' })

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/Usuario no encontrado/i)
  })
})

describe('PATCH /users/:username/avatar', () => {
  beforeAll(async () => {
    await createVerifiedUser('AvatarUser', 'avataruser@test.com')
  })

  it('cambia el avatar correctamente con un avatar válido', async () => {
    const res = await api
      .patch('/users/AvatarUser/avatar')
      .send({ profilePicture: 'disco.png' })

    expect(res.status).toBe(200)
    expect(res.body.message).toMatch(/actualizado correctamente/i)
    expect(res.body.profilePicture).toBe('disco.png')
  })

  it('el perfil refleja el nuevo avatar tras el cambio', async () => {
    await api
      .patch('/users/AvatarUser/avatar')
      .send({ profilePicture: 'rubia.png' })

    const profile = await api.get('/users/AvatarUser/profile')

    expect(profile.status).toBe(200)
    expect(profile.body.profilePicture).toBe('rubia.png')
  })

  it('acepta todos los avatares válidos', async () => {
    const validAvatars = ['seniora.png', 'disco.png', 'rubia.png', 'elvis.png']

    for (const avatar of validAvatars) {
      const res = await api
        .patch('/users/AvatarUser/avatar')
        .send({ profilePicture: avatar })

      expect(res.status).toBe(200)
      expect(res.body.profilePicture).toBe(avatar)
    }
  })

  it('devuelve 400 si el avatar no es uno de los permitidos', async () => {
    const res = await api
      .patch('/users/AvatarUser/avatar')
      .send({ profilePicture: 'avatar_inventado.png' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Avatar no válido/i)
  })

  it('devuelve 400 si falta el campo profilePicture', async () => {
    const res = await api
      .patch('/users/AvatarUser/avatar')
      .send({})

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Avatar no válido/i)
  })

  it('devuelve 400 si profilePicture es una cadena vacía', async () => {
    const res = await api
      .patch('/users/AvatarUser/avatar')
      .send({ profilePicture: '' })

    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/Avatar no válido/i)
  })

  it('devuelve 404 si el usuario no existe', async () => {
    const res = await api
      .patch('/users/UsuarioFantasma999/avatar')
      .send({ profilePicture: 'disco.png' })

    expect(res.status).toBe(404)
    expect(res.body.error).toMatch(/Usuario no encontrado/i)
  })

  it('devuelve 400 si el username del parámetro es inválido', async () => {
    const res = await api
      .patch('/users/../avatar')
      .send({ profilePicture: 'disco.png' })

    expect(res.status).toBe(400)
  })
})