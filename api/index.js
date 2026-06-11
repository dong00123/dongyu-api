import express from 'express';

const app = express();
const port = process.env.PORT || 8080;

const publicPath = process.cwd() + '/public';
app.use(express.static(publicPath));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(`${publicPath}/index.html`);
});

app.post('/api', async (req, res) => {
    const { query } = req.body;

    if (!query?.trim()) {
        return res.status(400).json({ error: '搜索内容不能为空' });
    }

    const apiKey = process.env.BWAI_API_KEY;

    if (!apiKey) {
        return res.status(500).json({ error: '中转API密钥未配置' });
    }

    const models = [
        'deepseek-chat',
        'gpt-4o-mini',
        'gpt-3.5-turbo',
        'claude-3-haiku-20240307'
    ];

    let lastError = '接口请求失败';

    try {
        for (const model of models) {
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
                lastError =
                    data.error?.message ||
                    data.message ||
                    data.raw ||
                    '接口请求失败';

                continue;
            }

            const answer = data.choices?.[0]?.message?.content;

            if (!answer) {
                lastError = '上游返回格式异常';
                continue;
            }

            return res.json({
                answer,
                model
            });
        }

        return res.status(502).json({
            error: `所有模型均不可用：${lastError}`
        });
    } catch (err) {
        console.error('请求出错：', err);
        res.status(500).json({ error: `服务异常：${err.message}` });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`服务启动在端口${port}`);
});
