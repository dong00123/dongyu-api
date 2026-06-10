import express from 'express';
const app = express();
const port = process.env.PORT || 3000;

// 设置 CORS 头
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});

app.use(express.json());

app.post('/api', async (req, res) => {
    const { query } = req.body;
    if (!query || !query.trim()) {
        return res.status(400).json({ error: '搜索内容不能为空' });
    }

    try {
        const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + process.env.DEEPSEEK_API_KEY
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: 'system', content: '你是一个智能搜索引擎助手，请根据用户的问题提供详细、准确的回答。回答要结构清晰，使用中文。' },
                    { role: 'user', content: query.trim() }
                ],
                temperature: 0.7,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `请求失败: ${response.status}`);
        }

        const data = await response.json();
        const answer = data.choices?.[0]?.message?.content || '未获取到回答';

        res.status(200).json({ answer });

    } catch (error) {
        console.error('API 错误:', error);
        res.status(500).json({ error: '搜索服务暂时不可用，请稍后重试' });
    }
});

// 托管静态文件（你的前端页面）
app.use(express.static('public'));

// 启动服务
app.listen(port, () => {
    console.log(`服务运行在端口 ${port}`);
});
