# 在另一台笔记本上演示 CounterLens

这个源码包包含当前本地改动，**不要求先提交 Git 或发布 GitHub Pages**。它不包含 node_modules、数据库文件、.env 或访问密钥。

## 提前准备一次

1. 将 ZIP 复制到笔记本并解压，进入包含 package.json 的目录。
2. 笔记本需要 Node.js 20.19+ 和 MongoDB Community 7+，并启动本地 MongoDB。连接地址使用默认的 `mongodb://127.0.0.1:27017`。
3. 在该目录打开终端，执行：

   ```sh
   npm ci
   npm run dev
   ```

   `npm ci` 首次安装需要网络。`npm run dev` 会同时启动网页和 API，终端要保持开启。

4. 浏览器打开 http://localhost:5173/?view=console 。默认本地 demo 自动连接；如果你另设了 MONITORING_TOKEN，请输入自己的 token。
5. 点击 **Generate showcase**。新笔记本会生成自己的模拟课堂，不依赖旧电脑上的数据库或旧的 showcase 链接。

Windows / macOS 的项目启动命令相同，MongoDB 的安装与启动方式取决于笔记本的系统。

## 演示顺序

- **Overview**：展示概览、活动趋势、问卷和系统指标。
- **Classroom & surveys**：查看事件分布、问卷结果和文字反馈。
- **System health**：查看 API、MongoDB、响应时间和错误。
- **Dataset release**：查看数据集版本、样本量、字段和质量检查。
- **New classroom → Open student view → Check-in**：提交一份示例答案，回控制台刷新，展示真正写入 MongoDB 的闭环。

所有 showcase 图表都有模拟数据标识。真实操作会进入另建的课堂，不混入模拟场次。

## 明天开始前

1. 确认 MongoDB 已启动。
2. 在项目目录执行 `npm run dev`。
3. 先访问 http://127.0.0.1:8787/readyz ，应显示 API 和 database 都为 `ok`。
4. 打开控制台，点击三个菜单确认不同标题和内容，再提交一份演示问卷。
5. 依赖装好之后，本地演示不需要外网；请保留终端，不要让笔记本睡眠。

## 常见问题

- **只有前端，问卷和监控不工作**：确认运行的是 `npm run dev`，不是 `npm run dev:web`；同时检查 MongoDB。
- **无法连接 MongoDB**：检查服务是否启动，默认地址是否为 127.0.0.1:27017。
- **Classroom not found**：使用没有 `class=showcase-...` 的控制台地址，再在这台笔记本上生成 showcase。
- **端口被占用**：关闭本项目先前运行的服务再启动；注意终端输出的实际网页端口。
- **想把 localhost 链接发给老师**：这个链接只指向打开浏览器的那台电脑。老师在旁边看你的屏幕或线上看你共享屏幕可以；老师在自己的电脑上直接点这个链接无法访问你的本地系统。

当前阶段无需为演示开放数据库端口或配置公网访问。等需要老师独立访问完整系统时，再部署 API 和数据库。
