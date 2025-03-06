const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const mongoose = require('mongoose');
const Address = require('./models/address');
const config = require('./config');

// 连接到 MongoDB
let isConnected = false;
const connectWithRetry = () => {
    mongoose.connect(config.mongodb.uri, config.mongodb.options)
        .then(() => {
            console.log('MongoDB 连接成功');
            isConnected = true;
            // 数据库连接成功后，自动加载数据
            loadInitialData();
        })
        .catch(err => {
            console.error('MongoDB 连接失败:', err);
            isConnected = false;
            // 添加重试机制
            console.log('5秒后尝试重新连接...');
            setTimeout(connectWithRetry, 5000);
        });
};

// 添加自动加载数据的函数
async function loadInitialData() {
    try {
        const addresses = await Address.find().sort({ createdAt: -1 });
        if (addresses.length > 0) {
            console.log('数据库中已有数据，无需初始化');
        } else {
            console.log('数据库为空，等待数据上传...');
        }
    } catch (error) {
        console.error('初始化数据加载失败:', error);
    }
}

connectWithRetry();

// 监听MongoDB连接状态
mongoose.connection.on('disconnected', () => {
    console.log('MongoDB连接断开，尝试重新连接...');
    isConnected = false;
    connectWithRetry();
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB连接错误:', err);
    isConnected = false;
});


const app = express();
const port = config.server.port;

// 启用CORS和body-parser中间件
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// 添加获取百度地图API密钥的端点
app.get('/api/map-key', (req, res) => {
    res.json({
        success: true,
        apiKey: config.baiduMap.apiKey
    });
});

// 配置文件上传
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// 创建uploads目录
const fs = require('fs');
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// 获取所有已存储的地址
app.get('/addresses', async (req, res) => {
    if (!isConnected) {
        return res.status(503).json({ error: 'MongoDB连接不可用' });
    }
    try {
        const addresses = await Address.find().sort({ createdAt: -1 });
        res.json({
            success: true,
            data: addresses
        });
    } catch (error) {
        console.error('获取地址数据失败:', error);
        res.status(500).json({ error: '获取地址数据失败' });
    }
});

// 健康检查端点
app.get('/health', (req, res) => {
    if (isConnected) {
        res.status(200).json({ status: 'ok', mongodb: 'connected' });
    } else {
        res.status(503).json({ status: 'error', mongodb: 'disconnected' });
    }
});

// 处理Excel文件上传
app.post('/upload', upload.single('file'), async (req, res) => {
    if (!isConnected) {
        return res.status(503).json({ error: 'MongoDB连接不可用' });
    }
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有上传文件' });
        }

        const workbook = xlsx.readFile(req.file.path);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(worksheet);

        // 删除临时文件
        fs.unlinkSync(req.file.path);

        // 验证数据格式
        const validData = data.filter(item => item.address);

        // 清除旧数据
        await Address.deleteMany({});
        console.log('已清除旧数据');

        // 直接返回数据
        res.json({
            success: true,
            data: validData
        });

        // 批量导入数据到数据库
        const batchSize = config.server.batchSize;
        for (let i = 0; i < validData.length; i += batchSize) {
            const batch = validData.slice(i, i + batchSize);
            try {
                await Address.insertMany(batch, { ordered: false });
                console.log(`成功导入第${i/batchSize + 1}批数据`);
            } catch (dbError) {
                console.error(`第${i/batchSize + 1}批数据导入失败:`, dbError);
            }
        }

    } catch (error) {
        console.error('文件处理错误:', error);
        res.status(500).json({ error: '文件处理失败' });
    }
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
    console.log('收到 SIGTERM 信号，准备关闭服务...');
    mongoose.connection.close(() => {
        console.log('MongoDB连接已关闭');
        process.exit(0);
    });
});