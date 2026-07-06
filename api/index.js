import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 8080;
const publicPath = `${process.cwd()}/public`;

app.use(cors());
app.use(express.static(publicPath));
app.use(express.json({ limit: '10mb' }));

app.get('/', (req, res) => {
    res.sendFile(`${publicPath}/index.html`);
});

// 原有对话接口（保留不变，客服聊天调用这个）
app.post('/api', async (req, res) => {
    const { query, imageBase64 } = req.body;

    if (!query?.trim()) {
        return res.status(400).json({ error: '搜索内容不能为空' });
    }

    const apiKey = process.env.BWAI_API_KEY;
    const model = process.env.BWAI_MODEL || 'gpt-5.4-mini';

    if (!apiKey) {
        return res.status(500).json({ error: '中转API密钥未配置' });
    }

    try {
        const userContent = imageBase64
            ? [
                { type: 'text', text: query.trim() },
                { type: 'image_url', image_url: { url: imageBase64 } }
            ]
            : query.trim();

        const response = await fetch('https://app.bwai.shop/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                messages: [
                    {
                        role: 'system',
                        content: imageBase64
                            ? '你是多模态图片问答助手。请认真观察用户上传的图片，并用中文直接回答用户的问题。'
                            : '你是电商智能客服机器人，支持订单查询、退款、产品推荐、知识库问答，回答简洁贴合电商场景'
                    },
                    {
                        role: 'user',
                        content: userContent
                    }
                ]
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                error: data.error?.message || data.message || '接口请求失败'
            });
        }

        const answer = data.choices?.[0]?.message?.content;
        return res.json({ answer, model });
    } catch (err) {
        res.status(500).json({ error: `服务异常：${err.message}` });
    }
});

// ===================== 新增客服后台全部功能接口 =====================
// 1. 功能菜单
app.get("/api/funcMenu", (req, res) => {
    res.json({
        list: ["订单查询", "产品推荐", "退款处理", "知识查询", "转人工"],
        enable: ["订单查询", "产品推荐", "退款处理"]
    })
})

// 2. 知识管理 获取知识库列表
app.get("/api/knowledge", (req, res) => {
    res.json({
        list: [
            { id: 1, question: "如何申请退款", answer: "进入我的订单页面，选择对应订单点击申请退款，审核通过后1-3个工作日原路返还" },
            { id: 2, question: "发货多久到货", answer: "普通快递3-5天，偏远地区5-7天" },
            { id: 3, question: "可以修改地址吗", answer: "未发货可联系客服修改，已发货无法更改收货地址" }
        ]
    })
})
// 新增知识库条目
app.post("/api/knowledge", (req, res) => {
    const { question, answer } = req.body;
    if (!question || !answer) return res.status(400).json({ error: "问题和答案不能为空" });
    res.json({ code: 0, msg: "知识添加成功", data: { question, answer } })
})

// 3. 机器人管理
app.get("/api/robot", (req, res) => {
    res.json({
        robots: [
            { id: 1, name: "电商客服v3.0", model: "gpt-5.4-mini", status: true, welcome: "你好，请问有什么可以帮您？" }
        ]
    })
})

// 4. 渠道管理
app.get("/api/channel", (req, res) => {
    res.json({ channels: ["网页客服", "小程序", "APP内嵌客服"] })
})

// 5. 工单管理
// 获取工单列表
app.get("/api/ticket", (req, res) => {
    res.json({
        list: [
            { ticketId: "TK10001", user: "用户8921", type: "退款纠纷", status: "待处理", time: "2026-07-06 10:22" },
            { ticketId: "TK10002", user: "用户7633", type: "商品破损", status: "已完结", time: "2026-07-05 15:10" }
        ]
    })
})
// 创建工单
app.post("/api/ticket", (req, res) => {
    const { userName, content } = req.body;
    if (!userName || !content) return res.status(400).json({ error: "用户与工单内容不能为空" });
    const ticketId = "TK" + Date.now();
    res.json({ code: 0, ticketId, msg: "工单创建成功，客服将尽快处理" })
})

// 6. 数据分析看板
app.get("/api/data", (req, res) => {
    res.json({
        totalChat: 1562,
        passRate: "98.2%",
        ticketTotal: 42,
        hotQuestion: ["退款流程", "发货时效", "商品质保", "改地址"]
    })
})

// 7. 系统全局配置
app.get("/api/config", (req, res) => {
    res.json({
        welcomeText: "你好，我是智能客服机器人v3.0",
        modelName: "gpt-5.4-mini",
        similarityThreshold: 0.7,
        transferManualSwitch: true
    })
})

// 8. 角色权限
app.get("/api/role", (req, res) => {
    res.json({ roles: ["超级管理员", "客服专员", "只读查看员"] })
})

// 9. 操作&对话日志
app.get("/api/log", (req, res) => {
    res.json({
        logs: [
            { time: "2026-07-06 11:30:22", content: "用户咨询退款流程" },
            { time: "2026-07-06 10:15:08", content: "管理员新增知识库条目" }
        ]
    })
})

// 启动服务
app.listen(port, '0.0.0.0', () => {
    console.log(`服务启动在端口 ${port}`);
});
