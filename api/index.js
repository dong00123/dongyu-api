import express from 'express';
const app = express();
const port = process.env.PORT || 8080;

// 中间件：解析 JSON 请求体
app.use(express.json());

// 托管静态文件（把 public 文件夹里的内容暴露出去）
app.use(express.static('public'));

// 处理 API 请求
app.post('/api', async (req, res) => {
    const { query } = req.body;
    if (!query || !query.trim()) {
        return res.status(400).json({ error: '搜索内容不能为空' });
    }

    try {
        // 替换为 bwai.shop 免费 API
        const response = await fetch('https://app.bwai.shop/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + process.env.BWAI_API_KEY
            },
            body: JSON.stringify({
                model: 'claude-3-haiku-20240307', // 免费体验的 Anthropic 模型
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
        res.status(500).json({ error: '搜索服务暂时不可用，请稍后再试' });
    }
});

// 启动服务
app.listen(port, () => {
    console.log(`服务运行在端口 ${port}`);
});
