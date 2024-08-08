const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  name: String,
  address: String,
  latitude: Number,
  longitude: Number,
  description: String,
});

module.exports = mongoose.model('Location', locationSchema);