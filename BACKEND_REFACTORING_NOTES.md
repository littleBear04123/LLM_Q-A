# 后端代码重构说明

## 重构概述

本次重构旨在改善项目的代码结构，提高可维护性和扩展性。我们将原本集中在几个文件中的代码按功能模块进行拆分和重组。

## 目录结构变更

### 重构前
```
server/
├── database.js
├── utils.js
├── routes/
│   ├── api.js
│   ├── projects.js
│   └── users.js
└── middleware/
    └── session.js
```

### 重构后
```
server/
├── database/
│   ├── index.js                 # 数据库主入口
│   ├── models/                  # 数据模型
│   │   ├── user.js              # 用户模型
│   │   ├── project.js           # 项目模型
│   │   ├── usecase.js           # 用例模型
│   │   ├── scenario.js          # 场景模型
│   │   └── message.js           # 消息模型
│   └── migrations/              # 数据库迁移
│       └── init.js              # 数据库初始化
├── routes/                      # 路由模块
│   ├── auth/                    # 认证相关
│   │   └── session.js           # 会话验证中间件
│   ├── users/                   # 用户相关路由
│   │   └── index.js
│   ├── projects/                # 项目相关路由
│   │   ├── index.js
│   │   └── helpers.js           # 项目相关工具函数
│   ├── usecases/                # 用例相关路由
│   │   └── index.js
│   └── scenarios/               # 场景相关路由
│       └── index.js
├── middleware/                  # 中间件
│   └── session.js               # 会话中间件
├── utils.js                     # 通用工具函数
├── config/                      # 配置文件
│   └── prompts.js               # AI提示词配置
└── server.js                    # 服务器主入口（原文件）
```

## 功能模块划分

### 1. 数据库模块 (server/database/)
- **Models**: 每个实体对应一个模型文件，封装了对数据库表的操作
- **Migrations**: 数据库初始化脚本，包含表结构定义
- **Index**: 数据库连接和模型实例化

### 2. 路由模块 (server/routes/)
- **Users**: 用户注册、登录、删除账户等
- **Projects**: 项目创建、获取、UML生成、删除等
- **Use Cases**: 用例管理相关操作
- **Scenarios**: 场景生成、对话、图表生成等
- **Auth**: 会话验证中间件

### 3. 中间件模块 (server/middleware/)
- **Session**: 会话验证逻辑

## 主要改进

1. **职责分离**: 每个模块只负责特定功能，降低耦合度
2. **易于维护**: 代码按功能分组，便于定位和修改
3. **可扩展性**: 新功能可以轻松添加到对应模块
4. **代码复用**: 工具函数和模型方法可在不同路由间共享

## 保持不变的功能

- 所有API端点路径保持不变
- 数据库表结构保持不变
- 前端与后端的通信协议保持不变
- 所有业务逻辑保持不变

## 注意事项

1. 重构过程中保持了所有原始功能和API路径不变
2. 数据库操作方法的签名保持一致
3. 会话验证机制保持不变
4. 错误处理和日志记录保持不变

## 测试建议

重构完成后，建议进行全面测试，包括：
- 用户登录/注册功能
- 项目创建和UML生成
- 用例提取和展示
- 场景对话和生成
- 图表生成功能