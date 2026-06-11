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

    if (!query?.trim()) {
        return res.status(400).json({ error: '搜索内容不能为空' });
    }

    const apiKey = process.env.BWAI_API_KEY;

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
                // 如果这个模型不可用，把这里换成 BWAI 后台支持的模型
                model: 'gpt-4o-mini',
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

        console.log('BWAI状态码：', response.status);
        console.log('BWAI返回：', text);

        let data;
        try {
            data = JSON.parse(text);
        } catch {
            data = { raw: text };
        }

        if (!response.ok) {
            return res.status(response.status).json({
                error:
                    data.error?.message ||
                    data.message ||
                    data.raw ||
                    '接口请求失败'
            });
        }

        const answer = data.choices?.[0]?.message?.content;

        if (!answer) {
            console.error('BWAI返回格式异常：', data);
            return res.status(502).json({ error: '上游返回格式异常' });
        }

        res.json({ answer });
    } catch (err) {
        console.error('请求出错：', err);
        res.status(500).json({ error: `服务异常：${err.message}` });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`服务启动在端口${port}`);
});
