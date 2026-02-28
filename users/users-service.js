const express = require('express');
const app = express();
const port = 3000;
const swaggerUi = require('swagger-ui-express');
const fs = require('node:fs');
const YAML = require('js-yaml');
const promBundle = require('express-prom-bundle');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const sanitize = require('mongo-sanitize');
const User = require('./users-model');
const crypto = require('crypto'); // tokens aleatorios

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/yovi';
mongoose.connect(mongoUri)
  .then(() => console.log('Conectado a MongoDB'))
  .catch(err => console.error('Error conectando a MongoDB:', err));


const metricsMiddleware = promBundle({includeMethod: true});
app.use(metricsMiddleware);

try {
  const swaggerDocument = YAML.load(fs.readFileSync('./openapi.yaml', 'utf8'));
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (e) {
  console.log(e);
}

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

// REGISTRO
app.post('/createuser', async (req, res) => {
  const { username, password, email, profilePicture } = req.body;
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Generamos un token aleatorio para la verificación
    const verificationToken = crypto.randomBytes(20).toString('hex');

    const user = new User({ 
      username, 
      password: hashedPassword,
      email,
      profilePicture: profilePicture || 'default-avatar.png',
      verificationToken
    });
    await user.save();

    // AQUÍ IRÍA EL ENVÍO REAL DEL CORREO (ej: usando Nodemailer y Google SMTP)
    // De momento lo simulamos en consola para poder probar:
    console.log(`\n[SIMULADOR DE CORREO] 📧`);
    console.log(`Para: ${email}`);
    console.log(`Mensaje: Haz clic en el siguiente enlace para verificar tu cuenta:`);
    console.log(`http://localhost:3000/verify?token=${verificationToken}\n`);

    res.json({ message: `Usuario registrado. Por favor, revisa tu correo para verificar tu cuenta.` });
  } catch (err) {
    if (err.code === 11000) {
      // Diferenciar si el duplicado es del username o del email
      if (err.message.includes('email')) {
        res.status(400).json({ error: 'El correo electrónico ya está en uso' });
      } else {
        res.status(400).json({ error: 'El nombre de usuario ya existe' });
      }
    } else {
      res.status(400).json({ error: err.message });
    }
  }
});

// NUEVA RUTA: VERIFICACIÓN DE CORREO
app.get('/verify', async (req, res) => {
  const { token } = req.query;
  try {
    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(400).json({ error: 'Token inválido o expirado' });
    }

    user.isVerified = true;
    user.verificationToken = undefined; // Limpiamos el token, ya se usó
    await user.save();

    res.json({ message: 'Correo verificado con éxito. Ya puedes iniciar sesión.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// LOGIN
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const user = await User.findOne({ username: sanitize(username) });
    if (!user) return res.status(401).json({ error: 'Usuario no encontrado' });

    // VERIFICAMOS SI EL CORREO ESTÁ CONFIRMADO
    if (!user.isVerified) {
      return res.status(403).json({ error: 'Por favor, verifica tu correo electrónico antes de iniciar sesión.' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'Contraseña incorrecta' });

    res.json({ message: `Bienvenido ${username}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`User Service listening at http://localhost:${port}`)
  })
}

module.exports = app