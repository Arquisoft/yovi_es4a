const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: { 
        type: String, 
        required: true, 
        unique: true // No pueden existir dos usuarios con el mismo nombre
    },
    email: { 
        type: String, 
        required: true, 
        unique: true // No pueden existir dos usuarios con el mismo correo
    },
    password: { 
        type: String, 
        required: true // La contraseña ya encriptada
    },
    profilePicture: { 
        type: String, 
        default: 'seniora.png' // Avatar por defecto
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    },

    isVerified: { 
        type: Boolean, 
        default: false 
    },
    verificationToken: { 
        type: String 
    },

    // Estadísticas de juego para el ranking
    stats: {
      gamesPlayed:  { type: Number, default: 0 },
      gamesWon:     { type: Number, default: 0 },
      gamesLost:    { type: Number, default: 0 },
      // Movimientos totales realizados (en partidas ganadas)
      totalMoves:   { type: Number, default: 0 },
    }
});

const User = mongoose.model('User', userSchema);

module.exports = User;