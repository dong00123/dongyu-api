import express from 'express';
const app = express();
const port = process.env.PORT || 8080;

// 中间件：解析 JSON 请求体
app.use(express.json());

// 托管静态文件
const publicPath = process.cwd() + '/public';
app.use(express.static(publicPath));

// 根路径强制返回 index.html
app.get('/', (req, res) => {
    res.sendFile(publicPath + '/index.html');
});

// 处理 API 请求（适配 bwai.shop 的 Claude 免费额度）
app.post('/api', async (req, res) => {
    const { query } = req.body;
    if (!query || !query.trim()) {
        return res.status(400).json({ error: '搜索内容不能为空' });
    }

    try {
        // 用平台支持的 Claude 模型名（OpenAI 兼容格式）
        const response = await fetch('https://app.bwai.shop/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + process.env.BWAI_API_KEY
            },
            body: JSON.stringify({
                // 换成平台免费额度支持的 Claude 模型
                model: 'claude-3-haiku', 
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
            console.error('API 错误详情:', response.status, errorData);
            throw new Error(errorData.error?.message || `请求失败: ${response.status}`);
        }

        const data = await response.json();
        const answer = data.choices?.[0]?.message?.content || '未获取到回答';

        res.status(200).json({ answer });
    } catch (error) {
        console.error('API 错误:', error);
        res.status(500).json({ error: '搜索出错：' + error.message });
    }
});

// 启动服务
app.listen(port, () => {
    console.log(`服务运行在端口 ${port}`);
    console.log(`静态文件路径: ${publicPath}`);
});
