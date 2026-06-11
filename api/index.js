export default async function handler(req, res) {
    // 跨域配置
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 处理浏览器 OPTIONS 预检请求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // 1. 首页路由 / （Vercel 静态文件会自动接管 public，这里可忽略）
    if (req.method === 'GET' && req.url === '/') {
        return res.status(200).send('请访问首页页面');
    }

    // 2. 只处理 POST /api 接口
    if (req.method !== 'POST') {
        return res.status(405).json({ error: "仅支持 POST 请求" });
    }

    const { query } = req.body || {};

    // 校验搜索内容
    if (!query?.trim()) {
        return res.status(400).json({ error: '搜索内容不能为空' });
    }

    // 读取环境变量（和你原来 Express 一致）
    const apiKey = process.env.BWAI_API_KEY;
    const model = process.env.BWAI_MODEL || 'gpt-5.4-mini';

    if (!apiKey) {
        return res.status(500).json({ error: '中转API密钥未配置' });
    }

    try {
        // 请求 BWAI 接口（地址、请求体完全沿用你原来的逻辑）
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

        // 日志（Vercel 后台 Logs 可以查看）
        console.log(`BWAI模型：${model}`);
        console.log('BWAI状态码：', response.status);
        console.log('BWAI返回：', text);

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            data = { raw: text };
        }

        // 上游接口报错
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

        // 提取回答
        const answer = data.choices?.[0]?.message?.content;
        if (!answer) {
            console.error('BWAI返回格式异常：', data);
            return res.status(502).json({ error: '上游返回格式异常' });
        }

        // 返回给前端
        return res.json({
            answer,
            model
        });

    } catch (err) {
        console.error('请求出错：', err);
        res.status(500).json({ error: `服务异常：${err.message}` });
    }
}
