FROM node:18-alpine

WORKDIR /app

# 复制 package.json 和 package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm install

# 复制项目文件
COPY . .

# 创建 uploads 目录
RUN mkdir -p uploads

# 暴露端口
EXPOSE 3000

# 启动应用
CMD ["npm", "start"]