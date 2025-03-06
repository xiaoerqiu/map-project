const winston = require('winston');
const path = require('path');

// 创建日志目录
const logDir = 'logs';
const fs = require('fs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

// 配置日志格式
const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message }) => {
        return `${timestamp} [${level.toUpperCase()}]: ${message}`;
    })
);

// 创建日志记录器
const logger = winston.createLogger({
    format: logFormat,
    transports: [
        // 控制台输出
        new winston.transports.Console(),
        // 记录所有级别的日志到文件
        new winston.transports.File({
            filename: path.join(logDir, 'app.log'),
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        }),
        // 单独记录错误日志
        new winston.transports.File({
            filename: path.join(logDir, 'error.log'),
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5,
            tailable: true
        })
    ]
});

module.exports = logger;