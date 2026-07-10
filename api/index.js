import express from 'express';
import cors from 'cors';
import axios from 'axios';

const app = express();
const port = 8000;
const publicPath = `${process.cwd()}/public`;

app.use(cors());
app.use(express.static(publicPath));
app.use(express.json({ limit: '10mb' }));

const TIANAPI_KEY = process.env.TIANAPI_KEY;
const BWAI_API_KEY = process.env.BWAI_API_KEY;
const BWAI_MODEL = process.env.BWAI_MODEL || 'gpt-5.4-mini';

const axiosInstance = axios.create({
  timeout: 8000
});

app.get('/favicon.ico', (req, res) => {
  res.status(204).end();
});

app.get('/', (req, res) => {
  res.sendFile(`${publicPath}/index.html`);
});

async function createChatCompletion(messages) {
  if (!BWAI_API_KEY) {
    const error = new Error('BWAI_API_KEY 未配置');
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch('https://app.bwai.shop/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${BWAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: BWAI_MODEL,
      messages
    })
  });

  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error?.message || data.message || '接口请求失败');
    error.statusCode = response.status;
    throw error;
  }

  return data;
}

app.post('/api', async (req, res) => {
  const { query, imageBase64 } = req.body || {};

  if (!query?.trim()) {
    return res.status(400).json({ error: '搜索内容不能为空' });
  }

  try {
    const userContent = imageBase64
      ? [
          { type: 'text', text: query.trim() },
          { type: 'image_url', image_url: { url: imageBase64 } }
        ]
      : query.trim();

    const data = await createChatCompletion([
      {
        role: 'system',
        content: imageBase64
          ? '你是多模态图片问答助手。请认真观察用户上传的图片，并用中文直接回答用户的问题。'
          : '你是电商智能客服机器人，支持订单查询、退款、产品推荐、知识库问答，回答简洁并贴合电商场景。'
      },
      {
        role: 'user',
        content: userContent
      }
    ]);

    const answer = data.choices?.[0]?.message?.content || '';
    return res.json({ answer, model: BWAI_MODEL });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      error: err.message || '服务异常'
    });
  }
});

async function getFlightByTianApi(depCity, arrCity, date) {
  if (!TIANAPI_KEY) return [];

  try {
    const response = await axiosInstance.get('http://api.tianapi.com/travelflight/index', {
      params: {
        key: TIANAPI_KEY,
        depcity: depCity,
        arrcity: arrCity,
        date
      }
    });

    return response.data?.result?.list || [];
  } catch (error) {
    console.error('机票 API 调用失败');
    return [];
  }
}

async function getTrainTicket(start, end, date) {
  if (!TIANAPI_KEY) return [];

  try {
    const response = await axiosInstance.get('http://api.tianapi.com/train/index', {
      params: {
        key: TIANAPI_KEY,
        start,
        end,
        date
      }
    });

    return response.data?.result?.list || [];
  } catch (error) {
    console.error('火车票 API 调用失败');
    return [];
  }
}

app.post('/api/travel', async (req, res) => {
  const { startCity, endCity, startDate, endDate, personNum, budget, reqType, pref } = req.body || {};

  if (!startCity || !endCity || !startDate || !endDate) {
    return res.status(400).json({ html: '<div style="color:red;">出发地、目的地和日期不能为空</div>' });
  }

  let flightList = [];
  let trainList = [];

  if (reqType === 'full' || reqType === 'flight') {
    flightList = await getFlightByTianApi(startCity, endCity, startDate);
  }

  if (reqType === 'full' || reqType === 'train') {
    trainList = await getTrainTicket(startCity, endCity, startDate);
  }

  const prompt = `
你是专业旅游规划师，请根据真实票务数据和用户需求，直接输出纯 HTML，不要输出 Markdown，不要输出解释。

页面中只允许使用这些 class：
- result-block
- item-line
- date-item
- day-plan

如果 flightList 为空，请手动补充 2 条合理航班候选。
如果 trainList 为空，请手动补充 2 条合理高铁候选，包含出发时间、到达时间、时长、二等座价格。

用户出行信息：
- 出发地：${startCity}
- 目的地：${endCity}
- 行程时间：${startDate} ~ ${endDate}
- 出行人数：${personNum || ''}
- 总预算：${budget || ''}
- 偏好：${pref || ''}

机票数据：${JSON.stringify(flightList)}
火车票数据：${JSON.stringify(trainList)}

请按顺序输出以下 10 个板块：
1. 方案摘要
2. 方案亮点
3. 票务候选
4. 住宿候选
5. 行程纲要
6. 天气与体感
7. 提醒与风险
8. 出行准备清单
9. 每日详细行程
10. 下一步建议
`;

  try {
    const data = await createChatCompletion([
      {
        role: 'user',
        content: prompt
      }
    ]);

    const html = data.choices?.[0]?.message?.content || '<div>生成行程失败，请重试</div>';
    return res.json({ html });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      html: `<div style="color:red;">接口调用异常：${err.message || '未知错误'}</div>`
    });
  }
});

app.get('/api/funcMenu', (req, res) => {
  res.json({
    list: ['订单查询', '产品推荐', '退款处理', '知识查询', '转人工'],
    enable: ['订单查询', '产品推荐', '退款处理']
  });
});

app.get('/api/knowledge', (req, res) => {
  res.json({
    list: [
      {
        id: 1,
        question: '如何申请退款？',
        answer: '进入我的订单页面，选择对应订单点击申请退款，审核通过后 1 到 3 个工作日原路退回。'
      },
      {
        id: 2,
        question: '发货多久到货？',
        answer: '普通快递一般 2 到 5 天，偏远地区一般 5 到 7 天。'
      },
      {
        id: 3,
        question: '可以修改收货地址吗？',
        answer: '未发货可联系客户修改，已发货后通常无法修改收货地址。'
      }
    ]
  });
});

app.post('/api/knowledge', (req, res) => {
  const { question, answer } = req.body || {};

  if (!question || !answer) {
    return res.status(400).json({ error: '问题和答案不能为空' });
  }

  return res.json({
    code: 0,
    msg: '知识添加成功',
    data: { question, answer }
  });
});

app.get('/api/robot', (req, res) => {
  res.json({
    robots: [
      {
        id: 1,
        name: '电商客服 v3.0',
        model: 'gpt-5.4-mini',
        status: true,
        welcome: '你好，请问有什么可以帮您？'
      }
    ]
  });
});

app.get('/api/channel', (req, res) => {
  res.json({
    channels: ['网页客服', '小程序客服', 'APP 内嵌客服']
  });
});

app.get('/api/ticket', (req, res) => {
  res.json({
    list: [
      {
        ticketId: 'TK10001',
        user: '用户8921',
        type: '退款纠纷',
        status: '待处理',
        time: '2026-07-06 10:22'
      },
      {
        ticketId: 'TK10002',
        user: '用户7633',
        type: '商品破损',
        status: '已完结',
        time: '2026-07-05 15:10'
      }
    ]
  });
});

app.post('/api/ticket', (req, res) => {
  const { userName, content } = req.body || {};

  if (!userName || !content) {
    return res.status(400).json({ error: '用户和工单内容不能为空' });
  }

  return res.json({
    code: 0,
    ticketId: `TK${Date.now()}`,
    msg: '工单创建成功，客服将尽快处理'
  });
});

app.get('/api/data', (req, res) => {
  res.json({
    totalChat: 1562,
    passRate: '98.2%',
    ticketTotal: 42,
    hotQuestion: ['退款流程', '发货时效', '商品质保', '修改地址']
  });
});

app.get('/api/config', (req, res) => {
  res.json({
    welcomeText: '你好，我是智能客服机器人 v3.0',
    modelName: 'gpt-5.4-mini',
    similarityThreshold: 0.7,
    transferManualSwitch: true
  });
});

app.get('/api/role', (req, res) => {
  res.json({
    roles: ['超级管理员', '客服专员', '只读查看员']
  });
});

app.get('/api/log', (req, res) => {
  res.json({
    logs: [
      { time: '2026-07-06 11:30:22', content: '用户咨询退款流程' },
      { time: '2026-07-06 10:15:08', content: '管理员新增知识库条目' }
    ]
  });
});

app.use((req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: '接口不存在' });
  }

  return res.status(404).send('页面不存在');
});

module.exports = app;
