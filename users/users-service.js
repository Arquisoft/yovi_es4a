const express = require('express');
const app = express();
const port = process.env.PORT || 8001;
const swaggerUi = require('swagger-ui-express');
const fs = require('node:fs');
const YAML = require('js-yaml');
const promBundle = require('express-prom-bundle');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const sanitize = require('mongo-sanitize');
const User = require('./users-model');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yovi';
if (process.env.NODE_ENV !== 'test') {
  mongoose.connect(mongoUri)
    .then(() => console.log('Conectado a MongoDB'))
    .catch(err => console.error('Error conectando a MongoDB:', err));
}

const metricsMiddleware = promBundle({includeMethod: true});
app.use(metricsMiddleware);

try {
  const swaggerDocument = YAML.load(fs.readFileSync('./openapi.yaml', 'utf8'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (e) {
  console.log(e);
}

// Configuración de CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

// ───────────────────────────────────────────────────────────────────
// HELPERS
function buildUserStats(stats = {}) {
  const gamesPlayed      = stats.gamesPlayed      || 0;
  const gamesWon         = stats.gamesWon         || 0;
  const gamesLost        = stats.gamesLost        || 0;
  const gamesDrawn       = stats.gamesDrawn       || 0;
  const gamesAbandoned   = stats.gamesAbandoned   || 0;
  const totalMoves       = stats.totalMoves       || 0;
  const currentWinStreak = stats.currentWinStreak || 0;

  return {
    gamesPlayed,
    gamesWon,
    gamesLost,
    gamesDrawn,
    gamesAbandoned,
    totalMoves,
    currentWinStreak,
    winRate: gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0,
  };
}

function normalizePositiveInteger(value, fallback) {
  const parsed = parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function validateRecordGame(body) {
  const allowedModes = ["classic_hvb", "classic_hvh", "tabu_hvh", "holey_hvh", "fortune_dice_hvh", "poly_hvh", "why_not_hvh"];
  const allowedResults = ["won", "lost", "abandoned", "draw"];

  const gameIdValidation = validateGameId(body.gameId);
  if (gameIdValidation.error) {
    return { error: gameIdValidation.error };
  }

  const mode = typeof body.mode === "string" ? body.mode.trim() : "";
  const result = typeof body.result === "string" ? body.result.trim() : "";
  const opponent = typeof body.opponent === "string" ? body.opponent.trim() : "";
  const startedBy = typeof body.startedBy === "string" ? body.startedBy.trim() : "";
  const boardSize = Number(body.boardSize);
  const totalMoves = Number(body.totalMoves);

  if (!allowedModes.includes(mode)) {
    return { error: "'mode' debe ser 'classic_hvb', 'classic_hvh', 'tabu_hvh', 'holey_hvh', 'fortune_dice_hvh', 'poly_hvh' o 'why_not_hvh'" };
  }

  if (!allowedResults.includes(result)) {
    return { error: "'result' debe ser 'won', 'lost', 'abandoned' o 'draw'" };
  }

  if (!Number.isFinite(boardSize) || boardSize <= 0) {
    return { error: "'boardSize' debe ser un número positivo" };
  }

  if (!Number.isFinite(totalMoves) || totalMoves < 0) {
    return { error: "'totalMoves' debe ser un número no negativo" };
  }

  return {
    value: {
      gameId: gameIdValidation.value,
      mode,
      result,
      opponent,
      startedBy,
      boardSize,
      totalMoves,
      finishedAt: new Date(),
    },
  };
}

function validateUsername(value) {
  const username = typeof value === "string" ? value.trim() : "";

  if (!username) {
    return { error: "El nombre de usuario es obligatorio." };
  }

  if (username.length < 3) {
    return { error: "El nombre de usuario debe tener al menos 3 caracteres." };
  }

  if (username.length > 20) {
    return { error: "El nombre de usuario no puede exceder los 20 caracteres." };
  }

  if (!/^[a-zA-Z0-9._-]+$/.test(username)) {
    return {
      error: "El usuario solo puede contener letras, números y los caracteres _ . -",
    };
  }

  if (/^[._-]/.test(username) || /[._-]$/.test(username)) {
    return {
      error: "El nombre de usuario no puede empezar ni terminar con puntos o guiones.",
    };
  }

  return { value: username };
}

function validateGameId(value) {
  const gameId = typeof value === "string" ? value.trim() : "";

  if (!gameId) {
    return { error: "'gameId' es obligatorio" };
  }

  if (gameId.length > 100) {
    return { error: "'gameId' no puede exceder los 100 caracteres" };
  }

  return { value: gameId };
}

// ───────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DE CORREO (NODEMAILER) 
// Para producción usa variables de entorno. Para probar con tu Gmail, 
// necesitas generar una "Contraseña de aplicación" en los ajustes de seguridad de Google.
function createMailTransporter() {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;

  if (!emailUser || !emailPass)
    return null;

  return nodemailer.createTransport({
    host: process.env.EMAIL_HOST || "smtp.gmail.com",
    port: Number(process.env.EMAIL_PORT || 465),
    secure: true,
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
}

// ───────────────────────────────────────────────────────────────────────────────
// REGISTRO
app.post('/createuser', async (req, res) => {
  const { username, password, email, profilePicture } = req.body;
  
  // 1. Validación formato de username
  const usernameValidation = validateUsername(username);
  if (usernameValidation.error) {
    return res.status(400).json({ error: usernameValidation.error });
  }

  // 2. Verificamos si el usuario ya existe (usamos el valor ya limpio/validado)
  const existingUser = await User.findOne({ $or: [{ email }, { username: usernameValidation.value }] });
  if (existingUser) {
    return res.status(400).json({ error: 'El usuario o el correo ya están en uso.' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(20).toString('hex');

    // 2. Preparamos el usuario
    const user = new User({
      username,
      password: hashedPassword,
      email,
      profilePicture: profilePicture || 'seniora.png',
      verificationToken
    });
    
    // Lo guardamos temporalmente en la base de datos
    await user.save();

    // 3. Preparamos el correo
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const verificationLink = `${frontendUrl}/verify?token=${verificationToken}`;

    const mailOptions = {
      from: `"Equipo YOVI" <${process.env.EMAIL_USER}>`,
      to: email, // El correo que el usuario escribió en el formulario
      subject: 'Verifica tu cuenta de YOVI',
      html: `
        <div style="font-family: Arial, sans-serif; text-align: center; padding: 30px; background-color: #f4f4f4;">
          <div style="background-color: white; max-width: 500px; margin: 0 auto; padding: 30px; border-radius: 10px; box-shadow: 0 4px 8px rgba(0,0,0,0.1);">
            <h2 style="color: #1F2A30;">¡Bienvenido a YOVI, ${username}!</h2>
            <p style="color: #555; font-size: 16px;">Gracias por registrarte. Para poder jugar y guardar tus estadísticas, necesitamos que verifiques tu dirección de correo electrónico.</p>
            <a href="${verificationLink}" style="display: inline-block; padding: 14px 28px; margin: 25px 0; background-color: #FF7B00; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Verificar mi cuenta</a>
            <p style="color: #999; font-size: 12px; margin-top: 20px;">Si no te has registrado en YOVI, puedes ignorar este correo de forma segura.</p>
          </div>
        </div>
      `
    };

// 4. Intentamos enviar el correo
    try {
      // Solo nos conectamos a Google si NO estamos en los tests
      if (process.env.NODE_ENV !== 'test') {
        const transporter = createMailTransporter();
        if (!transporter) {
           throw new Error("Las credenciales de correo no están configuradas en el servidor.");
        }
        await transporter.sendMail(mailOptions);
        console.log(`[CORREO ENVIADO]`);
      }
      
      // El mensaje de éxito se envía siempre, tanto en real como en tests
      res.status(201).json({ message: `¡Bienvenido ${username}! Por favor, revisa tu correo para verificar tu cuenta.` });
      
    } catch (mailError) {
      // 5. SI FALLA EL CORREO: Borramos al usuario para que pueda volver a intentarlo
      await User.findByIdAndDelete(user._id);
      console.error("Error enviando correo:", mailError);
      res.status(500).json({ error: 'Hubo un problema al enviar el correo de verificación. Por favor, asegúrate de que tu correo es válido e inténtalo de nuevo.' });
    }

  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// VERIFICACIÓN DE CORREO
app.get('/verify', async (req, res) => {
  const { token } = req.query;
  try {
    const user = await User.findOne({ verificationToken: sanitize(token) });
    if (!user) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }
    user.isVerified = true;
    user.verificationToken = undefined;
    await user.save();
    res.json({ message: 'Correo verificado con éxito. Ya puedes iniciar sesión y jugar.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// LOGIN
app.post('/login', async (req, res) => {
  const usernameValidation = validateUsername(req.body.username);
  const password = req.body.password;

  if (usernameValidation.error) {
    return res.status(400).json({ error: usernameValidation.error });
  }

  if (typeof password !== "string" || !password) {
    return res.status(400).json({ error: "La contraseña es obligatoria." });
  }

  const username = usernameValidation.value;

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    if (!user.isVerified) {
      return res.status(403).json({ error: 'Por favor, verifica tu correo electrónico en tu bandeja de entrada antes de iniciar sesión.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Contraseña incorrecta' });

    res.json({ message: `Bienvenido ${user.username}`, username: user.username, profilePicture: user.profilePicture });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// PERFIL DE USUARIO
app.get('/users/:username/profile', async (req, res) => {
  const usernameValidation = validateUsername(req.params.username);
  if (usernameValidation.error) {
    return res.status(400).json({ error: usernameValidation.error });
  }
  const username = usernameValidation.value;
  try {
    const user = await User.findOne(
      { username },
      { username: 1, email: 1, profilePicture: 1, _id: 0 }
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    res.json({ username: user.username, email: user.email, profilePicture: user.profilePicture });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// CAMBIAR CONTRASEÑA
app.put('/users/:username/password', async (req, res) => {
  const usernameValidation = validateUsername(req.params.username);
  if (usernameValidation.error) {
    return res.status(400).json({ error: usernameValidation.error });
  }
  const username = usernameValidation.value;
  const { oldPassword, newPassword } = req.body;

  if (typeof oldPassword !== 'string' || !oldPassword) {
    return res.status(400).json({ error: 'La contraseña actual es obligatoria.' });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres.' });
  }

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) return res.status(401).json({ error: 'La contraseña actual es incorrecta.' });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    res.json({ message: 'Contraseña actualizada correctamente.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// CAMBIAR NOMBRE DE USUARIO
app.patch('/users/:username/username', async (req, res) => {
  const usernameValidation = validateUsername(req.params.username);
  if (usernameValidation.error) {
    return res.status(400).json({ error: usernameValidation.error });
  }
  const username = usernameValidation.value;

  const newUsernameValidation = validateUsername(req.body.newUsername);
  if (newUsernameValidation.error) {
    return res.status(400).json({ error: newUsernameValidation.error });
  }
  const newUsername = newUsernameValidation.value;

  if (username === newUsername) {
    return res.status(400).json({ error: 'El nuevo nombre de usuario debe ser diferente al actual.' });
  }

  try {
    const existing = await User.findOne({ username: newUsername });
    if (existing) return res.status(400).json({ error: 'Ese nombre de usuario ya está en uso.' });

    const user = await User.findOneAndUpdate(
      { username },
      { username: newUsername },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json({ message: 'Nombre de usuario actualizado correctamente.', username: user.username });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// CAMBIAR AVATAR
app.patch('/users/:username/avatar', async (req, res) => {
  const usernameValidation = validateUsername(req.params.username);
  if (usernameValidation.error) {
    return res.status(400).json({ error: usernameValidation.error });
  }
  const username = usernameValidation.value;

  const allowedAvatars = ['seniora.png', 'disco.png', 'rubia.png', 'elvis.png'];
  const profilePicture = typeof req.body.profilePicture === 'string' ? req.body.profilePicture.trim() : '';

  if (!allowedAvatars.includes(profilePicture)) {
    return res.status(400).json({ error: 'Avatar no válido.' });
  }

  try {
    const user = await User.findOneAndUpdate(
      { username },
      { profilePicture },
      { new: true }
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json({ message: 'Avatar actualizado correctamente.', profilePicture: user.profilePicture });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// REGISTRAR PARTIDA + ACTUALIZAR ESTADÍSTICAS
app.post("/users/:username/games", async (req, res) => {
  const usernameValidation = validateUsername(req.params.username);
  if (usernameValidation.error) {
    return res.status(400).json({ error: usernameValidation.error });
  }

  const validation = validateRecordGame(req.body);
  if (validation.error)
    return res.status(400).json({ error: validation.error });

  const username = usernameValidation.value;
  const game = validation.value;

  try {
    const user = await User.findOne(
      { username },
      { username: 1, stats: 1, gameHistory: 1, _id: 1 }
    );

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const alreadyExists = Array.isArray(user.gameHistory)
      && user.gameHistory.some((savedGame) => savedGame.gameId === game.gameId);

    if (alreadyExists) {
      return res.status(409).json({
        error: "Esta partida ya fue registrada para este usuario.",
      });
    }

    const currentWinStreak = user.stats?.currentWinStreak || 0;

    const inc = {
      "stats.gamesPlayed": 1,
      "stats.totalMoves": game.totalMoves,
    };

    let nextWinStreak = 0;

    if (game.result === "won") {
      inc["stats.gamesWon"] = 1;
      nextWinStreak = currentWinStreak + 1;
    } else if (game.result === "lost") {
      inc["stats.gamesLost"] = 1;
      nextWinStreak = 0;
    } else if (game.result === "abandoned") {
      inc["stats.gamesAbandoned"] = 1;
      nextWinStreak = 0;
    } else if (game.result === "draw") {
      inc["stats.gamesDrawn"] = 1;
      nextWinStreak = 0;
    }

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      {
        $inc: inc,
        $set: {
          "stats.currentWinStreak": nextWinStreak,
        },
        $push: {
          gameHistory: {
            $each: [game],
            $position: 0,
          },
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    res.status(201).json({
      username: updatedUser.username,
      stats: buildUserStats(updatedUser.stats),
      savedGame: game,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// HISTORIAL PAGINADO CON FILTROS Y ORDEN
app.get("/users/:username/history", async (req, res) => {
  const usernameValidation = validateUsername(req.params.username);
  if (usernameValidation.error) {
    return res.status(400).json({ error: usernameValidation.error });
  }
  const username = usernameValidation.value;
  const page = normalizePositiveInteger(req.query.page, 1);
  const pageSize = Math.min(normalizePositiveInteger(req.query.pageSize, 5), 50);

  const validModes = ["classic_hvb", "classic_hvh", "tabu_hvh", "holey_hvh", "fortune_dice_hvh", "poly_hvh", "why_not_hvh"];
  const validResults = ["won", "lost", "abandoned", "draw"];
  const validSorts = ["newest", "oldest", "movesDesc", "movesAsc"];

  const mode = validModes.includes(req.query.mode) ? req.query.mode : null;
  const result = validResults.includes(req.query.result) ? req.query.result : null;
  const sortBy = validSorts.includes(req.query.sortBy) ? req.query.sortBy : "newest";

  try {
    const user = await User.findOne(
      { username },
      { username: 1, profilePicture: 1, stats: 1, gameHistory: 1, _id: 0 }
    );

    if (!user)
      return res.status(404).json({ error: "Usuario no encontrado" });

    let history = Array.isArray(user.gameHistory) ? [...user.gameHistory] : [];

    if (mode)
      history = history.filter((game) => game.mode === mode);

    if (result)
      history = history.filter((game) => game.result === result);

    history.sort((a, b) => {
      if (sortBy === "oldest")
        return new Date(a.finishedAt).getTime() - new Date(b.finishedAt).getTime();

      if (sortBy === "movesDesc")
        return b.totalMoves - a.totalMoves;

      if (sortBy === "movesAsc")
        return a.totalMoves - b.totalMoves;

      return new Date(b.finishedAt).getTime() - new Date(a.finishedAt).getTime();
    });

    const totalGames = history.length;
    const totalPages = totalGames === 0 ? 1 : Math.ceil(totalGames / pageSize);
    const safePage = Math.min(page, totalPages);
    const startIndex = (safePage - 1) * pageSize;
    const endIndex = startIndex + pageSize;

    res.json({
      username: user.username,
      profilePicture: user.profilePicture,
      stats: buildUserStats(user.stats),
      pagination: {
        page: safePage,
        pageSize,
        totalGames,
        totalPages,
      },
      games: history.slice(startIndex, endIndex),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// ENDPOINT LEGACY DE STATS
app.patch('/users/:username/stats', async (req, res) => {
  const usernameValidation = validateUsername(req.params.username);
  if (usernameValidation.error) {
    return res.status(400).json({ error: usernameValidation.error });
  }
  const username = usernameValidation.value;
  const { won, totalMoves } = req.body;

  if (typeof won !== 'boolean') {
    return res.status(400).json({ error: "'won' debe ser un booleano" });
  }
  if (typeof totalMoves !== 'number' || totalMoves < 0) {
    return res.status(400).json({ error: "'totalMoves' debe ser un número no negativo" });
  }

  try {
    const existingUser = await User.findOne(
      { username },
      { username: 1, stats: 1, _id: 1 }
    );

    if (!existingUser) return res.status(404).json({ error: 'Usuario no encontrado' });

    const currentWinStreak = existingUser.stats?.currentWinStreak || 0;

    const inc = {
      "stats.gamesPlayed": 1,
      "stats.totalMoves": totalMoves,
    };

    let nextWinStreak = 0;

    if (won) {
      inc['stats.gamesWon']   = 1;
      nextWinStreak = currentWinStreak + 1;
    } else {
      inc['stats.gamesLost'] = 1;
      nextWinStreak = 0;
    }

    const user = await User.findByIdAndUpdate(
      existingUser._id,
      {
        $inc: inc,
        $set: {
          "stats.currentWinStreak": nextWinStreak,
        },
      },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json({
      username: user.username,
      stats: buildUserStats(user.stats),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// RANKING
/**
 * GET /ranking?sortBy=winRate|gamesWon|gamesPlayed&limit=20
 * Devuelve la lista de usuarios ordenada por la métrica solicitada.
 * sortBy: 'winRate' (% partidas ganadas, default),
 *         'gamesWon' (partidas ganadas), 'gamesPlayed' (cantidad de partidas)
 */
app.get('/ranking', async (req, res) => {
  const { sortBy = 'winRate', page = 1, pageSize, limit } = req.query;
  const validSortFields = ['winRate', 'gamesWon', 'gamesPlayed', 'gamesLost', 'gamesDrawn', 'gamesAbandoned', 'totalMoves'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'winRate';
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const sizeNum = Math.min(100, Math.max(1, Number.parseInt(pageSize || limit, 10) || 20));

  try {
    const users = await User.find({ 'stats.gamesPlayed': { $gt: 0 } }, { 
      username: 1, 
      profilePicture: 1, 
      stats: 1, 
      gameHistory: 1
    });

    const calculateStats = (user, isWeekly = false) => {
      let stats = user.stats || {};
      
      if (isWeekly) {
        const lastWeek = new Date();
        lastWeek.setDate(lastWeek.getDate() - 7);
        const weeklyGames = (user.gameHistory || []).filter(g => new Date(g.finishedAt) >= lastWeek);
        
        const won = weeklyGames.filter(g => g.result === 'won').length;
        const lost = weeklyGames.filter(g => g.result === 'lost').length;
        const drawn = weeklyGames.filter(g => g.result === 'draw').length;
        const abandoned = weeklyGames.filter(g => g.result === 'abandoned').length;
        const totalMoves = weeklyGames.reduce((acc, g) => acc + (g.totalMoves || 0), 0);

        return {
          gamesPlayed: weeklyGames.length,
          gamesWon: won,
          gamesLost: lost,
          gamesDrawn: drawn,
          gamesAbandoned: abandoned,
          totalMoves: totalMoves,
          winRate: weeklyGames.length > 0 ? Math.round((won / weeklyGames.length) * 100) : 0
        };
      }
      
      return {
        gamesPlayed: stats.gamesPlayed || 0,
        gamesWon: stats.gamesWon || 0,
        gamesLost: stats.gamesLost || 0,
        gamesDrawn: stats.gamesDrawn || 0,
        gamesAbandoned: stats.gamesAbandoned || 0,
        totalMoves: stats.totalMoves || 0,
        winRate: (stats.gamesPlayed > 0) ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0
      };
    };

    let ranked = users.map(u => ({
      username: u.username,
      profilePicture: u.profilePicture,
      ...calculateStats(u, false)
    }));

    ranked.sort((a, b) => (b[sortField] || 0) - (a[sortField] || 0));

    const weeklyData = users.map(u => ({
      username: u.username,
      profilePicture: u.profilePicture,
      stats: calculateStats(u, true)
    })).filter(u => u.stats.gamesPlayed > 0);

    const podium = {
      mostGames: [...weeklyData].sort((a, b) => b.stats.gamesPlayed - a.stats.gamesPlayed)[0] || null,
      mostWins: [...weeklyData].sort((a, b) => b.stats.gamesWon - a.stats.gamesWon)[0] || null,
      bestRate: [...weeklyData].sort((a, b) => (b.stats.winRate - a.stats.winRate) || (b.stats.gamesPlayed - a.stats.gamesPlayed))[0] || null
    };

    const totalItems = ranked.length;
    const startIndex = (pageNum - 1) * sizeNum;
    const paginated = ranked.slice(startIndex, startIndex + sizeNum);

    res.json({ 
      sortBy: sortField, 
      podium,
      pagination: {
        totalItems,
        page: pageNum,
        pageSize: sizeNum,
        totalPages: Math.ceil(totalItems / sizeNum)
      },
      ranking: paginated
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ───────────────────────────────────────────────────────────────────────────────
// STATS INDIVIDUALES
app.get('/users/:username/stats', async (req, res) => {
  const usernameValidation = validateUsername(req.params.username);
  if (usernameValidation.error) {
    return res.status(400).json({ error: usernameValidation.error });
  }
  const username = usernameValidation.value;
  try {
    const user = await User.findOne(
      { username },
      { username: 1, profilePicture: 1, stats: 1, _id: 0 }
    );
    if (!user)
      return res.status(404).json({ error: 'Usuario no encontrado' });

    res.json({
      username: user.username,
      profilePicture: user.profilePicture,
      stats: buildUserStats(user.stats),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const http = require('node:http');
const { Server } = require("socket.io");

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Importar y configurar manejador de websockets
require('./socket-handler')(io);

if (process.env.NODE_ENV !== 'test') {
  server.listen(port, () => { console.log(`User service running on port ${port} with WebSockets`); });
}

module.exports = app;
