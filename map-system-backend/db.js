const mongoose = require('mongoose');

mongoose.connect('mongodb+srv://caiyiqiu2019:US3g9QHitfmQkh9S@cluster0.yaw96.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

module.exports = mongoose;