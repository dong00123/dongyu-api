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

// 核心：用 Claude 原生格式调用 bwai.shop 的 Anthropic 接口
app.post('/api', async (req, res) => {
    const { query } = req.body;
    if (!query || !query.trim()) {
        return res.status(400).json({ error: '搜索内容不能为空' });
    }

    try {
        // 1. 构建 Claude 原生请求体
        const systemPrompt = '你是一个智能搜索引擎助手，请根据用户的问题提供详细、准确的回答。回答要结构清晰，使用中文。';
        const userMessage = query.trim();

        // 2. 调用 bwai.shop 的 Claude 原生接口（必须用 /v1/messages）
        const response = await fetch('https://app.bwai.shop/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + process.env.BWAI_API_KEY,
                'anthropic-version': '2023-06-01' // Claude API 必须带这个 Header
            },
            body: JSON.stringify({
                // 用平台免费体验分组支持的 Claude 模型
                model: 'claude-3-haiku-20240307',
                max_tokens: 2000,
                system: systemPrompt,
                messages: [
                    { role: 'user', content: userMessage }
                ]
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('API 错误详情:', response.status, errorData);
            throw new Error(errorData.error?.message || `请求失败: ${response.status}`);
        }

        const data = await response.json();
        // 3. 把 Claude 响应转换成前端能识别的格式
        const answer = data.content?.[0]?.text || '未获取到回答';

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
