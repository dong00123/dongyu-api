import express from 'express';
const app = express();
const port = process.env.PORT || 8080;

// 托管前端静态文件
const publicPath = process.cwd() + '/public';
app.use(express.static(publicPath));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(`${publicPath}/index.html`);
});

// 适配中转API的搜索接口
app.post('/api', async (req, res) => {
    const { query } = req.body;
    if (!query?.trim()) return res.status(400).json({ error: '搜索内容不能为空' });

    // 从环境变量读取你的中转密钥，避免硬编码泄露
    const apiKey = process.env.BWAI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: '中转API密钥未配置' });

    try {
        const response = await fetch('https://app.bwai.shop/v1/chat/completions', {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "claude-3-haiku-20240307",
                messages: [
                    { role: "system", content: "你是智能搜索助手，用中文给出清晰详细的回答" },
                    { role: "user", content: query.trim() }
                ]
            })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error?.message || '接口请求失败');
        const answer = data.choices[0].message.content;
        res.json({ answer });
    } catch (err) {
        console.error('请求出错：', err);
        res.status(500).json({ error: `服务异常：${err.message}` });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`服务启动在端口${port}`);
});
