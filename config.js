const config = {
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/map_annotation',
        options: {
            // MongoDB 7.0+ 默认启用这些选项
            // 添加超时设置
            connectTimeoutMS: 10000,
            socketTimeoutMS: 45000,
            maxPoolSize: 10
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