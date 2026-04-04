const mongoose = require('mongoose');

const gameHistorySchema = new mongoose.Schema(
    {
        gameId: {
            type: String,
            required: true,
        },
        mode: {
            type: String,
            enum: ["classic_hvb", "classic_hvh", "tabu_hvh", "holey_hvh", "fortune_dice_hvh", "poly_hvh"],
            required: true,
        },
        result: {
            type: String,
            enum: ["won", "lost", "abandoned"],
            required: true,
        },
        boardSize: {
            type: Number,
            required: true,
            min: 1,
        },
        totalMoves: {
            type: Number,
            required: true,
            min: 0,
            default: 0,
        },
        opponent: {
            type: String,
            default: "",
        },
        startedBy: {
            type: String,
            default: "",
        }, 
        finishedAt: {
            type: Date,
            default: Date.now,
        },
    },
    { _id: false}
)

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

    // Estadísticas de juego
    stats: {
      gamesPlayed:    { type: Number, default: 0 },
      gamesWon:       { type: Number, default: 0 },
      gamesLost:      { type: Number, default: 0 },
      gamesAbandoned: { type: Number, default: 0 },
      totalMoves:     { type: Number, default: 0 },
    },

    // Historial de partidas
    gameHistory: {
        type: [gameHistorySchema],
        default: [],
    }
});

module.exports = mongoose.models.User || mongoose.model("User", userSchema);