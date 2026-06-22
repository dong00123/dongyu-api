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
                            : '你是智能搜索助手，用中文给出清晰详细的回答'
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

// 启动服务
app.listen(port, '0.0.0.0', () => {
    console.log(`服务启动在端口 ${port}`);
});
