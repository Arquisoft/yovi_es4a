const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
  email: { type: String, required: true, unique: true},
  profilePicture: { type: String, default:'webapp/public/avatars/seniora.png' },

  isVerified: { type: Boolean, default: false },
  verificationToken: { type: String }
});

module.exports = mongoose.models.User || mongoose.model('User', userSchema);