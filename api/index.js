import express from 'express';
const app = express();
const port = process.env.PORT || 8080;

// 中间件：解析 JSON 请求体
app.use(express.json());

// 托管静态文件（你的东玉搜索前端页面）
const publicPath = process.cwd() + '/public';
app.use(express.static(publicPath));

// 根路径返回东玉搜索页面
app.get('/', (req, res) => {
    res.sendFile(publicPath + '/index.html');
});

// 处理搜索请求，调用 OpenRouter 上的 deepseek-r1 模型
app.post('/api', async (req, res) => {
    const { query } = req.body;
    if (!query || !query.trim()) {
        return res.status(400).json({ error: '搜索内容不能为空' });
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
                // 这两个请求头可以避免被限流
                'HTTP-Referer': 'https://dongyu-api-production.up.railway.app',
                'X-Title': 'Dongyu Search'
            },
            body: JSON.stringify({
                // 用 OpenRouter 免费支持的 deepseek-r1 模型
                model: 'deepseek/deepseek-r1',
                messages: [
                    { 
                        role: 'system', 
                        content: '你是一个智能搜索引擎助手，请根据用户的问题提供详细、准确的回答。回答要结构清晰，使用中文。' 
                    },
                    { role: 'user', content: query.trim() }
                ],
                temperature: 0.7,
                max_tokens: 2000
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API 错误:', response.status, errorData);
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

// 启动服务，Railway 必须绑定 0.0.0.0
app.listen(port, '0.0.0.0', () => {
    console.log(`服务运行在端口 ${port}`);
});
