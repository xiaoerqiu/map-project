const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const Location = require('../models/Location');

const router = express.Router();
const upload = multer({ dest: 'uploads/' });

router.get('/', async (req, res) => {
  try {
    const locations = await Location.find();
    res.json(locations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/import', upload.single('file'), async (req, res) => {
  try {
    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    for (const row of data) {
      const location = new Location({
        name: row.name,
        address: row.address,
        latitude: row.latitude,
        longitude: row.longitude,
        description: row.description,
      });
      await location.save();
    }

    res.status(201).json({ message: 'Data imported successfully' });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Add more routes for updating and deleting locations

module.exports = router;