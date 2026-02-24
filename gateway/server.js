const express = require('express');
const axios = require('axios');
const cors = require('cors');
const promBundle = require('express-prom-bundle');

const app = express();
const port = 8000;

// URLs internas de Docker
const userServiceUrl = process.env.USER_SERVICE_URL || 'http://users:3000';
const gameyServiceUrl = process.env.GAMEY_SERVICE_URL || 'http://gamey:4000';

app.use(cors());
app.use(express.json());
app.use(promBundle({ includeMethod: true }));

// Rutas de Usuario
app.post('/login', async (req, res) => {
  try {
    const response = await axios.post(`${userServiceUrl}/login`, req.body);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || {error: "Error"});
  }
});

app.post('/adduser', async (req, res) => {
  try {
    const response = await axios.post(`${userServiceUrl}/adduser`, req.body);
    res.json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(error.response?.data || {error: "Error"});
  }
});

// Rutas de Juego (Gamey)
app.post('/api/game/new', async (req, res) => {
  try {
    const response = await axios.post(`${gameyServiceUrl}/v1/game/new`, req.body);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Error en el motor" });
  }
});

app.listen(port, () => console.log(`Gateway interno en puerto ${port}`));