const express = require('express');
const app = express();
const port = process.env.PORT || 8080;

// 这行你之前漏了，必须加上
const publicPath = process.cwd() + '/public';

app.use(express.json());
app.use(express.static(publicPath));

app.get('/', (req, res) => {
    res.sendFile(publicPath + '/index.html');
});

app.post('/api', async (req, res) => {
    const { query } = req.body;
    if (!query || !query.trim()) {
        return res.status(400).json({ error: '搜索内容不能为空' });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;
    console.log('OPENROUTER_API_KEY:', apiKey ? '已读取到' : '未读取到');

    // 这里逻辑写反了，修正为 !apiKey
    if (!apiKey) {
        return res.status(500).json({ error: 'OPENROUTER_API_KEY 环境变量未配置' });
    }

    try {
        // 修正了 OpenRouter 的 API 地址，去掉了多余的 /api
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                // 修正了 Referer 域名
                'HTTP-Referer': 'https://dongyu-api-production.up.railway.app',
                'X-Title': 'Dongyu Search'
            },
            body: JSON.stringify({
                model: 'openai/gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: '你是一个智能搜索引擎助手，请根据用户的问题提供详细、准确的回答。回答要结构清晰，使用中文。'
                    },
                    {
                        role: 'user',
                        content: query.trim()
                    }
                ],
                temperature: 0.7,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('OpenRouter 错误:', response.status, errorData);
            throw new Error(errorData.error?.message || `请求失败: ${response.status}`);
        }

        const data = await response.json();
        const answer = data.choices?.[0]?.message?.content || '未获取到回答';
        res.status(200).json({ answer });
    } catch (error) {
        console.error('API 错误:', error);
        res.status(500).json({ error: '搜索服务暂时不可用：' + error.message });
    }
});

app.listen(port, '0.0.0.0', () => {
    console.log(`服务运行在端口 ${port}`);
});
