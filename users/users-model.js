const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  email: { type: String, required: true, unique: true},
  picture: { type: String, required: true },

  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String }
});

module.exports = mongoose.model('User', userSchema);