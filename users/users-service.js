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

// ─── CONFIGURACIÓN DE CORREO (NODEMAILER) ────────────────────────────────────
// Para producción usa variables de entorno. Para probar con tu Gmail, 
// necesitas generar una "Contraseña de aplicación" en los ajustes de seguridad de Google.
const transporter = nodemailer.createTransport({
  service: 'gmail', // Puedes cambiarlo por outlook, yahoo, etc.
  auth: {
    user: process.env.EMAIL_USER || 'tu_correo_de_prueba@gmail.com', 
    pass: process.env.EMAIL_PASS || 'tu_contraseña_de_aplicacion'
  }
});

// ─── REGISTRO ────────────────────────────────────────────────────────────────
app.post('/createuser', async (req, res) => {
  const { username, password, email, profilePicture } = req.body;
  
  // 1. Verificamos si el usuario ya existe antes de hacer nada
  const existingUser = await User.findOne({ $or: [{ email }, { username }] });
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
            <h2 style="color: #1F2A30;">¡Bienvenido a YOVI, ${sanitize(username)}!</h2>
            <p style="color: #555; font-size: 16px;">Gracias por registrarte. Para poder jugar y guardar tus estadísticas, necesitamos que verifiques tu dirección de correo electrónico.</p>
            <a href="${verificationLink}" style="display: inline-block; padding: 14px 28px; margin: 25px 0; background-color: #FF7B00; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">Verificar mi cuenta</a>
            <p style="color: #999; font-size: 12px; margin-top: 20px;">Si no te has registrado en YOVI, puedes ignorar este correo de forma segura.</p>
          </div>
        </div>
      `
    };

    // 4. Intentamos enviar el correo
    try {
      await transporter.sendMail(mailOptions);
      console.log(`[CORREO ENVIADO] Para: ${email}`);
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

// ─── VERIFICACIÓN DE CORREO ───────────────────────────────────────────────────
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

// ─── LOGIN ────────────────────────────────────────────────────────────────────
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username: sanitize(username) });
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    if (!user.isVerified) {
      return res.status(403).json({ error: 'Por favor, verifica tu correo electrónico en tu bandeja de entrada antes de iniciar sesión.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Contraseña incorrecta' });

    res.json({ message: `Bienvenido ${username}`, username: user.username, profilePicture: user.profilePicture });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ACTUALIZAR ESTADÍSTICAS DE JUEGO ────────────────────────────────────────
/**
 * PATCH /users/:username/stats
 * Body: { won: boolean, totalMoves: number }
 * Incrementa las estadísticas del usuario tras una partida.
 * totalMoves solo se acumula en partidas ganadas.
 */
app.patch('/users/:username/stats', async (req, res) => {
  const { username } = req.params;
  const { won, totalMoves } = req.body;

  if (typeof won !== 'boolean') {
    return res.status(400).json({ error: "'won' debe ser un booleano" });
  }
  if (typeof totalMoves !== 'number' || totalMoves < 0) {
    return res.status(400).json({ error: "'totalMoves' debe ser un número no negativo" });
  }

  try {
    const inc = { 'stats.gamesPlayed': 1 };
    if (won) {
      inc['stats.gamesWon']   = 1;
      inc['stats.totalMoves'] = totalMoves; // solo se acumula al ganar
    } else {
      inc['stats.gamesLost'] = 1;
    }

    const user = await User.findOneAndUpdate(
      { username: sanitize(username) },
      { $inc: inc },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const s = user.stats;
    res.json({
      username: user.username,
      stats: {
        gamesPlayed: s.gamesPlayed,
        gamesWon:    s.gamesWon,
        gamesLost:   s.gamesLost,
        totalMoves:  s.totalMoves,
        winRate:     s.gamesPlayed > 0 ? Math.round((s.gamesWon / s.gamesPlayed) * 100) : 0,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── RANKING ──────────────────────────────────────────────────────────────────
/**
 * GET /ranking?sortBy=winRate|gamesWon|gamesPlayed&limit=20
 * Devuelve la lista de usuarios ordenada por la métrica solicitada.
 * sortBy: 'winRate' (% partidas ganadas, default),
 *         'gamesWon' (partidas ganadas), 'gamesPlayed' (cantidad de partidas)
 */
app.get('/ranking', async (req, res) => {
  const validSortFields = ['winRate', 'gamesWon', 'gamesPlayed'];
  const sortBy = validSortFields.includes(req.query.sortBy) ? req.query.sortBy : 'winRate';
  const limit  = Math.min(parseInt(req.query.limit) || 20, 100);

  try {
    const users = await User.find(
      { 'stats.gamesPlayed': { $gt: 0 } },
      { username: 1, profilePicture: 1, stats: 1, _id: 0 }
    );

    const ranked = users.map(u => {
      const s = u.stats;
      const gamesPlayed = s.gamesPlayed || 0;
      const gamesWon    = s.gamesWon    || 0;
      const winRate     = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;

      return {
        username:       u.username,
        profilePicture: u.profilePicture,
        gamesPlayed,
        gamesWon,
        gamesLost:  s.gamesLost  || 0,
        totalMoves: s.totalMoves || 0,
        winRate,
      };
    });

    ranked.sort((a, b) => b[sortBy] - a[sortBy]);

    res.json({ sortBy, ranking: ranked.slice(0, limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── PERFIL DE USUARIO ────────────────────────────────────────────────────────
/**
 * GET /users/:username/stats
 * Devuelve las estadísticas individuales de un usuario.
 */
app.get('/users/:username/stats', async (req, res) => {
  const { username } = req.params;
  try {
    const user = await User.findOne(
      { username: sanitize(username) },
      { username: 1, profilePicture: 1, stats: 1, _id: 0 }
    );
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    const s = user.stats;
    const gamesPlayed = s.gamesPlayed || 0;
    const gamesWon    = s.gamesWon    || 0;

    res.json({
      username: user.username,
      profilePicture: user.profilePicture,
      stats: {
        gamesPlayed,
        gamesWon,
        gamesLost:  s.gamesLost  || 0,
        totalMoves: s.totalMoves || 0,
        winRate:    gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0,
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`User Service listening at http://localhost:${port}`)
  })
}

module.exports = app;