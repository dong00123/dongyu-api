import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const port = process.env.PORT || 8080;
const publicPath = `${process.cwd()}/public`;

app.use(cors());
app.use(express.static(publicPath));
app.use(express.json({ limit: '10mb' }));

// ===================== 修复：静默处理 favicon.ico =====================
app.get('/favicon.ico', (req, res) => {
    res.status(204).end(); // 204 No Content，不产生任何日志噪音
});

// ===================== 修复：统一 404 处理 =====================
app.use((req, res, next) => {
    // 如果是 API 请求，返回 JSON 格式的 404
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: '接口不存在' });
    }
    // 页面请求返回 HTML 404（可自定义）
    res.status(404).sendFile(`${publicPath}/404.html`) || res.status(404).send('页面不存在');
});

app.get('/', (req, res) => {
    res.sendFile(`${publicPath}/index.html`);
});

// 原有对话接口
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

// ===================== 旅游Agent 后端接口 =====================
// ✅ 修复：只从环境变量读取，不硬编码
const TIANAPI_KEY = process.env.TIANAPI_KEY;
if (!TIANAPI_KEY) {
    console.warn('⚠️ 警告：TIANAPI_KEY 未配置，旅游票务功能将不可用');
}

// ✅ 修复：添加超时控制
const axiosInstance = axios.create({
    timeout: 8000, // 8秒超时
});

async function getFlightByTianApi(depCity, arrCity, date) {
    if (!TIANAPI_KEY) return [];
    try {
        const url = "http://api.tianapi.com/travelflight/index";
        const res = await axiosInstance.get(url, {
            params: {
                key: TIANAPI_KEY,
                depcity: depCity,
                arrcity: arrCity,
                date: date
            }
        });
        return res.data.result?.list || [];
    } catch (err) {
        // ✅ 修复：只打印一次错误，不循环打印
        console.error("机票API调用失败");
        return [];
    }
}

async function getTrainTicket(start, end, date) {
    if (!TIANAPI_KEY) return [];
    try {
        const url = "http://api.tianapi.com/train/index";
        const resp = await axiosInstance.get(url, {
            params: {
                key: TIANAPI_KEY,
                start: start,
                end: end,
                date: date
            }
        });
        return resp.data.result?.list || [];
    } catch (e) {
        console.error("火车票API调用失败");
        return [];
    }
}

// 旅游方案生成接口
app.post('/api/travel', async (req, res) => {
    const { startCity, endCity, startDate, endDate, personNum, budget, reqType, pref } = req.body;
    let flightList = [];
    let trainList = [];

    if (reqType === "full" || reqType === "flight") {
        flightList = await getFlightByTianApi(startCity, endCity, startDate);
    }
    if (reqType === "full" || reqType === "train") {
        trainList = await getTrainTicket(startCity, endCity, startDate);
    }

    const prompt = `
你是专业旅游规划师，严格根据下方真实票务接口数据+用户出行需求，**仅输出纯HTML代码**，禁止任何多余解释、markdown格式、前言后语。
页面已有固定CSS样式，只能使用下面指定class：
.result-block 每个大板块外层容器
.item-line 单条机票/火车票/住宿条目行
.date-item 单条天气信息行
.day-plan 单日行程区块

【强制兜底硬性要求，必须遵守】
1. 如果机票数组flightList为空，必须手动生成2条合理航班信息，用item-line格式写入票务候选；
2. 如果火车票数组trainList为空，必须手动生成3条高铁车次（包含出发时间、到达时间、行程时长、二等座单价），逐条展示，绝对不能只写"无实时数据"；
3. 所有板块严格按顺序输出，只输出HTML，不要任何额外文字说明。

用户出行信息：
出发地：${startCity}
目的地：${endCity}
行程时间段：${startDate} ~ ${endDate}
出行人数：${personNum}
总预算：${budget}
个人出行偏好：${pref}

接口实时获取机票JSON数据：${JSON.stringify(flightList)}
接口实时获取火车票JSON数据：${JSON.stringify(trainList)}

必须按顺序生成以下10个板块HTML结构：
1.方案摘要
2.方案亮点
3.票务候选（机票、火车票逐条罗列）
4.住宿候选（结合目的地与总预算推荐2-3家酒店）
5.行程纲要
6.天气与体感（按照行程起止日期生成对应日期天气）
7.提醒与风险
8.出行准备清单
9.每日分天详细行程
10.下一步建议动作

所有班次时间、票价、车次优先使用接口返回真实数据，接口无数据时必须自行填充合理内容。
`;

    const apiKey = process.env.BWAI_API_KEY;
    const model = process.env.BWAI_MODEL || 'gpt-5.4-mini';
    try {
        const llmResp = await fetch('https://app.bwai.shop/v1/chat/completions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model,
                messages: [
                    { role: "user", content: prompt }
                ]
            })
        });
        const llmData = await llmResp.json();
        const htmlStr = llmData.choices?.[0]?.message?.content || "<div>生成行程失败，请重试</div>";
        res.json({ html: htmlStr });
    } catch (err) {
        res.status(500).json({ html: `<div style="color:red;">接口调用异常：${err.message}</div>` });
    }
});

// ===================== 原有客服后台全部功能接口 =====================
app.get("/api/funcMenu", (req, res) => {
    res.json({
        list: ["订单查询", "产品推荐", "退款处理", "知识查询", "转人工"],
        enable: ["订单查询", "产品推荐", "退款处理"]
    })
})

app.get("/api/knowledge", (req, res) => {
    res.json({
        list: [
            { id: 1, question: "如何申请退款", answer: "进入我的订单页面，选择对应订单点击申请退款，审核通过后1-3个工作日原路返还" },
            { id: 2, question: "发货多久到货", answer: "普通快递3-5天，偏远地区5-7天" },
            { id: 3, question: "可以修改地址吗", answer: "未发货可联系客服修改，已发货无法更改收货地址" }
        ]
    })
})

app.post("/api/knowledge", (req, res) => {
    const { question, answer } = req.body;
    if (!question || !answer) return res.status(400).json({ error: "问题和答案不能为空" });
    res.json({ code: 0, msg: "知识添加成功", data: { question, answer } })
})

app.get("/api/robot", (req, res) => {
    res.json({
        robots: [
            { id: 1, name: "电商客服v3.0", model: "gpt-5.4-mini", status: true, welcome: "你好，请问有什么可以帮您？" }
        ]
    })
})

app.get("/api/channel", (req, res) => {
    res.json({ channels: ["网页客服", "小程序", "APP内嵌客服"] })
})

app.get("/api/ticket", (req, res) => {
    res.json({
        list: [
            { ticketId: "TK10001", user: "用户8921", type: "退款纠纷", status: "待处理", time: "2026-07-06 10:22" },
            { ticketId: "TK10002", user: "用户7633", type: "商品破损", status: "已完结", time: "2026-07-05 15:10" }
        ]
    })
})

app.post("/api/ticket", (req, res) => {
    const { userName, content } = req.body;
    if (!userName || !content) return res.status(400).json({ error: "用户与工单内容不能为空" });
    const ticketId = "TK" + Date.now();
    res.json({ code: 0, ticketId, msg: "工单创建成功，客服将尽快处理" })
})

app.get("/api/data", (req, res) => {
    res.json({
        totalChat: 1562,
        passRate: "98.2%",
        ticketTotal: 42,
        hotQuestion: ["退款流程", "发货时效", "商品质保", "改地址"]
    })
})

app.get("/api/config", (req, res) => {
    res.json({
        welcomeText: "你好，我是智能客服机器人v3.0",
        modelName: "gpt-5.4-mini",
        similarityThreshold: 0.7,
        transferManualSwitch: true
    })
})

app.get("/api/role", (req, res) => {
    res.json({ roles: ["超级管理员", "客服专员", "只读查看员"] })
})

app.get("/api/log", (req, res) => {
    res.json({
        logs: [
            { time: "2026-07-06 11:30:22", content: "用户咨询退款流程" },
            { time: "2026-07-06 10:15:08", content: "管理员新增知识库条目" }
        ]
    })
})
export default app;
