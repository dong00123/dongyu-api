import express from 'express';
import cors from 'cors';

const app = express();
const port = process.env.PORT || 8080;
const publicPath = `${process.cwd()}/public`;

// 中间件
app.use(cors()); // 允许跨域请求（关键，否则前端无法调用）
app.use(express.static(publicPath)); // 托管静态文件
app.use(express.json()); // 解析 JSON 请求体

// 首页路由
app.get('/', (req, res) => {
    res.sendFile(`${publicPath}/index.html`);
});

// 核心 API 接口
app.post('/api', async (req, res) => {
    const { query } = req.body;

    if (!query?.trim()) {
        return res.status(400).json({ error: '搜索内容不能为空' });
    }

    const apiKey = process.env.BWAI_API_KEY;
    const model = process.env.BWAI_MODEL || 'gpt-5.4-mini';

    if (!apiKey) {
        return res.status(500).json({ error: '中转API密钥未配置' });
    }

    try {
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
                        content: '你是智能搜索助手，用中文给出清晰详细的回答'
                    },
                    {
                        role: 'user',
                        content: query.trim()
                    }
                ]
            })
        });

        const text = await response.text();

        console.log(`BWAI模型：${model}`);
        console.log('BWAI状态码：', response.status);
        console.log('BWAI返回：', text);

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            data = { raw: text };
        }

        if (!response.ok) {
            const errorMessage =
                data.error?.message ||
                data.message ||
                data.raw ||
                '接口请求失败';

            return res.status(response.status).json({
                error: errorMessage
            });
        }

        const answer = data.choices?.[0]?.message?.content;

        if (!answer) {
            console.error('BWAI返回格式异常：', data);
            return res.status(502).json({ error: '上游返回格式异常' });
        }

        return res.json({
            answer,
            model
        });
    } catch (err) {
        console.error('请求出错：', err);
        res.status(500).json({ error: `服务异常：${err.message}` });
    }
});

// 启动服务
app.listen(port, '0.0.0.0', () => {
    console.log(`服务启动在端口 ${port}`);
});
