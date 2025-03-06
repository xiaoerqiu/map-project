const config = {
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/map_annotation',
        options: {
            // MongoDB 7.0+ 连接配置
            connectTimeoutMS: 30000,
            socketTimeoutMS: 60000,
            serverSelectionTimeoutMS: 30000,
            heartbeatFrequencyMS: 1000,
            // 连接池配置
            maxPoolSize: 50,
            minPoolSize: 5,
            maxIdleTimeMS: 30000,
            // 读写重试
            retryWrites: true,
            retryReads: true,
            // 额外的稳定性配置
            keepAlive: true,
            keepAliveInitialDelay: 300000
        }
    },
    server: {
        port: process.env.PORT || 3000,
        // 批量导入时的批次大小
        batchSize: 100
    },
    baiduMap: {
        // 从环境变量获取百度地图API密钥，如果没有则使用默认值
        apiKey: process.env.BAIDU_MAP_API_KEY || 'your_default_api_key_here'
    }
};

module.exports = config;