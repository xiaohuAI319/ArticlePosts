import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Table, Tag, message, Spin, Alert, Modal, QRCode, Progress, List, Tooltip, Input, Select, Divider, Tabs } from 'antd';
import { PlayCircleOutlined, StopOutlined, ReloadOutlined, EyeOutlined, QrcodeOutlined, CloseCircleOutlined, RocketOutlined, CheckCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';

const { TabPane } = Tabs;
const { Option } = Select;

function TestPage() {
  // T015 登录测试相关状态
  const [platforms, setPlatforms] = useState([]);
  const [activeLogins, setActiveLogins] = useState([]);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [currentLogin, setCurrentLogin] = useState(null);
  const [loading, setLoading] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [loginProgress, setLoginProgress] = useState({});

  // T016 发布测试相关状态
  const [articles, setArticles] = useState([
    { id: 1, title: '测试文章1 - T016发布任务管理测试', word_count: 1500, status: 0 },
    { id: 2, title: '测试文章2 - Electron应用开发', word_count: 2000, status: 0 },
    { id: 3, title: '测试文章3 - 前端开发实践', word_count: 1200, status: 0 }
  ]);
  const [publishTasks, setPublishTasks] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState(1);
  const [selectedPublishPlatform, setSelectedPublishPlatform] = useState(null);
  const [currentPublishTask, setCurrentPublishTask] = useState(null);
  const [publishLoading, setPublishLoading] = useState(false);
  const [publishLogs, setPublishLogs] = useState([]);
  const [publishStats, setPublishStats] = useState(null);

  // 获取平台列表
  const fetchPlatforms = async () => {
    try {
      const result = await window.electronAPI.platforms.findAll(true);
      if (result.success) {
        setPlatforms(Array.isArray(result.data) ? result.data : []);
      } else {
        message.error(result.message);
        setPlatforms([]);
      }
    } catch (error) {
      message.error('获取平台列表失败');
      setPlatforms([]);
    }
  };

  
  // 获取活跃登录列表
  const fetchActiveLogins = async () => {
    try {
      const result = await window.electronAPI.autoLogin.getActiveLogins();
      if (result.success) {
        setActiveLogins(result.data || []);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('获取活跃登录列表失败');
    }
  };

  // 获取发布任务列表
  const fetchPublishTasks = async () => {
    try {
      const result = await window.electronAPI.publish.getActiveTasks();
      if (result.success) {
        setPublishTasks(Array.isArray(result.data) ? result.data : []);
      } else {
        message.error(result.message);
        setPublishTasks([]);
      }
    } catch (error) {
      message.error('获取发布任务列表失败');
      setPublishTasks([]);
    }
  };

  // 获取发布统计信息
  const fetchPublishStats = async () => {
    try {
      const result = await window.electronAPI.publish.getStats();
      if (result.success) {
        setPublishStats(result.data);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('获取发布统计失败');
    }
  };

  // 监控登录状态
  const monitorLoginStatus = (loginId) => {
    const interval = setInterval(async () => {
      try {
        const result = await window.electronAPI.autoLogin.getStatus(loginId);
        if (result.success) {
          const loginData = result.data;

          // 更新当前登录状态
          setCurrentLogin(loginData);
          setLoginProgress(prev => ({
            ...prev,
            [loginId]: loginData
          }));

          // 检查是否需要显示二维码
          if (loginData.qrCodeData && loginData.qrCodeData.data) {
            setQrCodeData(loginData.qrCodeData);
            setQrModalVisible(true);
          }

          // 登录成功或失败时停止监控
          if (['success', 'failed', 'cancelled'].includes(loginData.status)) {
            clearInterval(interval);

            if (loginData.status === 'success') {
              message.success(`${loginData.platformName} 登录成功！`);
              setQrModalVisible(false);
            } else if (loginData.status === 'failed') {
              message.error(`${loginData.platformName} 登录失败：${loginData.error}`);
              setQrModalVisible(false);
            } else if (loginData.status === 'cancelled') {
              message.info(`${loginData.platformName} 登录已取消`);
              setQrModalVisible(false);
            }

            // 刷新列表
            fetchActiveLogins();
          }
        }
      } catch (error) {
        console.error('获取登录状态失败:', error);
      }
    }, 2000); // 每2秒检查一次

    // 设置清理函数
    return () => clearInterval(interval);
  };

  // 监控发布任务状态
  const monitorPublishTask = (taskId) => {
    const interval = setInterval(async () => {
      try {
        const result = await window.electronAPI.publish.getTaskStatus(taskId);
        if (result.success) {
          const taskData = result.data;
          setCurrentPublishTask(taskData);

          // 任务完成或失败时停止监控
          if (['success', 'failed', 'cancelled'].includes(taskData.status)) {
            clearInterval(interval);

            if (taskData.status === 'success') {
              message.success('发布任务完成！');
            } else if (taskData.status === 'failed') {
              message.error(`发布任务失败：${taskData.error_message}`);
            } else if (taskData.status === 'cancelled') {
              message.info('发布任务已取消');
            }

            // 刷新列表
            fetchPublishTasks();
            fetchPublishStats();
          }
        }
      } catch (error) {
        console.error('获取发布任务状态失败:', error);
      }
    }, 1000); // 每1秒检查一次

    // 设置清理函数
    return () => clearInterval(interval);
  };

  // 启动登录
  const startLogin = async (platform) => {
    setLoading(true);
    setSelectedPlatform(platform);
    setCurrentLogin(null);
    setQrCodeData(null);

    try {
      const result = await window.electronAPI.autoLogin.start(platform.id, {
        headless: false,
        timeout: 180000 // 3分钟超时
      });

      if (result.success) {
        const loginId = result.data.loginId;
        setCurrentLogin(result.data);

        message.success(`开始登录 ${platform.display_name}`);

        // 开始监控登录状态
        const cleanup = monitorLoginStatus(loginId);

        // 设置清理函数到组件状态
        setCurrentLogin(prev => ({
          ...prev,
          cleanup
        }));

        // 刷新活跃登录列表
        fetchActiveLogins();
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('启动登录失败');
    } finally {
      setLoading(false);
    }
  };

  // 测试创建发布任务
  const testCreatePublishTask = async () => {
    if (!selectedPublishPlatform) {
      message.error('请先选择发布平台');
      return;
    }

    setPublishLoading(true);
    try {
      const result = await window.electronAPI.publish.createTask({
        articleId: selectedArticle,
        platformId: selectedPublishPlatform,
        maxRetries: 3,
        articleData: {
          title: articles.find(a => a.id === selectedArticle)?.title || '测试文章',
          content: '这是一篇测试文章的内容，用于验证T016发布任务管理功能。包含测试标题、测试内容和测试数据。',
          word_count: articles.find(a => a.id === selectedArticle)?.word_count || 1000
        }
      });

      if (result.success) {
        message.success('发布任务创建成功！');
        setCurrentPublishTask(result.data);

        // 开始监控任务状态
        const cleanup = monitorPublishTask(result.data.id);
        setCurrentPublishTask(prev => ({
          ...prev,
          cleanup
        }));

        // 刷新任务列表
        fetchPublishTasks();
      } else {
        message.error(result.error);
      }
    } catch (error) {
      message.error('创建发布任务失败');
    } finally {
      setPublishLoading(false);
    }
  };

  // 测试启动发布任务
  const testStartPublishTask = async () => {
    if (!currentPublishTask) {
      message.error('请先创建发布任务');
      return;
    }

    if (currentPublishTask.status !== 0) {
      message.error('只有待处理状态的任务才能启动');
      return;
    }

    setPublishLoading(true);
    try {
      const result = await window.electronAPI.publish.startTask(currentPublishTask.id);

      if (result.success) {
        message.success('发布任务启动成功！');
        setCurrentPublishTask(result.data);

        // 刷新任务列表
        fetchPublishTasks();
      } else {
        message.error(result.error);
      }
    } catch (error) {
      message.error('启动发布任务失败');
    } finally {
      setPublishLoading(false);
    }
  };

  // 测试更新任务进度
  const testUpdateProgress = async () => {
    if (!currentPublishTask) {
      message.error('请先创建发布任务');
      return;
    }

    try {
      const progress = Math.min(currentPublishTask.progress + 20, 100);
      const result = await window.electronAPI.publish.updateProgress(
        currentPublishTask.id,
        progress,
        `测试进度 ${progress}%`
      );

      if (result.success) {
        message.success('进度更新成功');
        setCurrentPublishTask(result.data);
      } else {
        message.error(result.error);
      }
    } catch (error) {
      message.error('更新进度失败');
    }
  };

  // 测试完成任务
  const testCompleteTask = async () => {
    if (!currentPublishTask) {
      message.error('请先创建发布任务');
      return;
    }

    try {
      const result = await window.electronAPI.publish.completeTask(currentPublishTask.id, {
        publishedUrl: 'https://test.example.com/article/123',
        platformArticleId: 'test_123',
        message: '测试发布完成'
      });

      if (result.success) {
        message.success('任务完成成功');
        setCurrentPublishTask(null);
        fetchPublishTasks();
        fetchPublishStats();
      } else {
        message.error(result.error);
      }
    } catch (error) {
      message.error('完成任务失败');
    }
  };

  // 测试失败任务
  const testFailTask = async () => {
    if (!currentPublishTask) {
      message.error('请先创建发布任务');
      return;
    }

    try {
      const result = await window.electronAPI.publish.failTask(currentPublishTask.id, {
        error: '测试失败',
        canRetry: true
      });

      if (result.success) {
        message.success('任务失败测试成功');
        setCurrentPublishTask(result.data);
      } else {
        message.error(result.error);
      }
    } catch (error) {
      message.error('标记任务失败失败');
    }
  };

  // 获取任务日志
  const fetchTaskLogs = async (taskId) => {
    try {
      const result = await window.electronAPI.publish.getTaskLogs(taskId, 50);
      if (result.success) {
        setPublishLogs(result.data || []);
      } else {
        message.error(result.error);
      }
    } catch (error) {
      message.error('获取任务日志失败');
    }
  };

  // 刷新数据
  const refreshData = async () => {
    await Promise.all([
      fetchPlatforms(),
      fetchActiveLogins(),
      fetchPublishTasks(),
      fetchPublishStats()
    ]);
  };

  useEffect(() => {
    refreshData();

    return () => {
      // 清理登录监控
      if (currentLogin && currentLogin.cleanup) {
        currentLogin.cleanup();
      }
      // 清理发布任务监控
      if (currentPublishTask && currentPublishTask.cleanup) {
        currentPublishTask.cleanup();
      }
    };
  }, []);

  // 平台表格列定义
  const platformColumns = [
    {
      title: '平台名称',
      dataIndex: 'display_name',
      key: 'display_name',
      render: (text, record) => (
        <Space>
          <span>{text}</span>
          {record.is_active ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>}
        </Space>
      )
    },
    {
      title: '登录方式',
      dataIndex: ['config_schema', 'auth_method'],
      key: 'auth_method',
      render: (method) => {
        const methodMap = {
          'qr_code': '扫码登录',
          'password': '密码登录',
          'oauth': 'OAuth登录'
        };
        return methodMap[method] || method;
      }
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => startLogin(record)}
            loading={loading && selectedPlatform?.id === record.id}
            disabled={!record.is_active}
          >
            开始登录
          </Button>
        </Space>
      )
    }
  ];

  // 文章表格列定义
  const articleColumns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text) => text || '无标题'
    },
    {
      title: '字数',
      dataIndex: 'word_count',
      key: 'word_count'
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => new Date(time).toLocaleString()
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Button
          type={selectedArticle === record.id ? 'primary' : 'default'}
          onClick={() => setSelectedArticle(record.id)}
        >
          {selectedArticle === record.id ? '已选择' : '选择'}
        </Button>
      )
    }
  ];

  // 处理单个任务启动
  const handleStartTask = async (task) => {
    if (task.status !== 0) {
      message.error('只有待处理状态的任务才能启动');
      return;
    }

    try {
      const result = await window.electronAPI.publish.startTask(task.id);
      if (result.success) {
        message.success('任务启动成功！');
        // 刷新任务列表
        fetchPublishTasks();
        // 如果是当前监控的任务，也更新状态
        if (currentPublishTask && currentPublishTask.id === task.id) {
          setCurrentPublishTask(result.data);
        }
      } else {
        message.error(result.error);
      }
    } catch (error) {
      message.error('启动任务失败');
    }
  };

  // 处理单个任务取消
  const handleCancelTask = async (task) => {
    if (['success', 'failed', 'cancelled'].includes(task.status)) {
      message.error('任务已完成或已取消，无需取消');
      return;
    }

    try {
      const result = await window.electronAPI.publish.cancelTask(task.id);
      if (result.success) {
        message.success('任务取消成功！');
        // 刷新任务列表
        fetchPublishTasks();
        // 如果是当前监控的任务，也更新状态
        if (currentPublishTask && currentPublishTask.id === task.id) {
          setCurrentPublishTask(result.data);
        }
      } else {
        message.error(result.error);
      }
    } catch (error) {
      message.error('取消任务失败');
    }
  };

  // 查看单个任务日志
  const handleViewTaskLogs = async (task) => {
    await fetchTaskLogs(task.id);
  };

  // 监控单个任务状态
  const handleMonitorTask = (task) => {
    if (currentPublishTask && currentPublishTask.cleanup) {
      currentPublishTask.cleanup();
    }

    setCurrentPublishTask(task);
    const cleanup = monitorPublishTask(task.id);
    setCurrentPublishTask(prev => ({
      ...prev,
      cleanup
    }));

    message.success(`开始监控任务 ${task.id}`);
  };

  // 发布任务表格列定义
  const publishTaskColumns = [
    {
      title: '任务ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: '文章',
      dataIndex: 'article_id',
      key: 'article_id',
      render: (articleId) => {
        const article = articles.find(a => a.id === articleId);
        return article ? article.title || '无标题' : `文章${articleId}`;
      }
    },
    {
      title: '平台',
      dataIndex: 'platform_id',
      key: 'platform_id',
      render: (platformId) => {
        const platform = platforms.find(p => p.id === platformId);
        return platform ? platform.display_name : `平台${platformId}`;
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusMap = {
          0: { color: 'blue', text: '待处理' },
          1: { color: 'orange', text: '进行中' },
          2: { color: 'green', text: '成功' },
          3: { color: 'red', text: '失败' },
          4: { color: 'gray', text: '已取消' }
        };
        const config = statusMap[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '进度',
      dataIndex: 'progress',
      key: 'progress',
      render: (progress) => <Progress percent={progress} size="small" />
    },
    {
      title: '重试次数',
      dataIndex: 'retry_count',
      key: 'retry_count',
      width: 80
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (time) => new Date(time).toLocaleString()
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          {record.status === 0 && (
            <Tooltip title="启动任务">
              <Button
                type="primary"
                size="small"
                icon={<PlayCircleOutlined />}
                onClick={() => handleStartTask(record)}
                loading={publishLoading}
              >
                启动
              </Button>
            </Tooltip>
          )}

          {record.status === 1 && (
            <Tooltip title="取消任务">
              <Button
                size="small"
                icon={<StopOutlined />}
                onClick={() => handleCancelTask(record)}
                loading={publishLoading}
              >
                取消
              </Button>
            </Tooltip>
          )}

          <Tooltip title="监控任务状态">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleMonitorTask(record)}
              type={currentPublishTask?.id === record.id ? 'primary' : 'default'}
            >
              监控
            </Button>
          </Tooltip>

          <Tooltip title="查看任务日志">
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleViewTaskLogs(record)}
            >
              日志
            </Button>
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Tabs defaultActiveKey="login" type="card">
        <TabPane tab="T015 登录测试" key="login">
          <Card title="T015 平台自动化登录测试" style={{ marginBottom: '20px' }}>
            <Alert
              message="测试说明"
              description="此页面用于测试T015平台自动化登录功能。选择平台后点击'开始登录'，系统将自动打开浏览器并处理登录流程。支持扫码登录和密码登录等多种方式。"
              type="info"
              showIcon
              style={{ marginBottom: '20px' }}
            />

            <Space style={{ marginBottom: '20px' }}>
              <Button icon={<ReloadOutlined />} onClick={refreshData}>
                刷新
              </Button>
            </Space>

            {/* 当前登录状态 */}
            {currentLogin && (
              <Card
                title={`当前登录：${currentLogin.platformName}`}
                style={{ marginBottom: '20px' }}
                size="small"
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <strong>状态：</strong>
                    <Tag color="blue">{currentLogin.status}</Tag>
                  </div>
                  <div>
                    <strong>进度：</strong>
                    <Progress
                      percent={Math.round((currentLogin.status === 'success' ? 100 : 50))}
                      size="small"
                      status={currentLogin.status === 'failed' ? 'exception' : 'active'}
                    />
                  </div>
                  {currentLogin.error && (
                    <div>
                      <strong>错误：</strong>
                      <span style={{ color: 'red' }}>{currentLogin.error}</span>
                    </div>
                  )}
                </Space>
              </Card>
            )}

            <h4>可用平台</h4>
            <Table
              dataSource={platforms}
              columns={platformColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>

          <Card title="活跃登录流程">
            <Table
              dataSource={activeLogins}
              columns={[
                {
                  title: '登录ID',
                  dataIndex: 'id',
                  key: 'id',
                  width: 200,
                  render: (text) => <code>{text.substring(0, 20)}...</code>
                },
                {
                  title: '平台',
                  dataIndex: 'platformName',
                  key: 'platformName'
                },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  render: (status) => {
                    const statusConfig = {
                      'starting': { color: 'blue', text: '启动中' },
                      'success': { color: 'green', text: '登录成功' },
                      'failed': { color: 'red', text: '登录失败' },
                      'cancelled': { color: 'gray', text: '已取消' }
                    };
                    const config = statusConfig[status] || { color: 'default', text: status };
                    return <Tag color={config.color}>{config.text}</Tag>;
                  }
                },
                {
                  title: '开始时间',
                  dataIndex: 'startTime',
                  key: 'startTime',
                  render: (time) => new Date(time).toLocaleString()
                }
              ]}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </TabPane>

        <TabPane tab="T016 发布测试" key="publish">
          <Card title="T016 发布任务管理测试" style={{ marginBottom: '20px' }}>
            <Alert
              message="测试说明"
              description="此页面用于测试T016发布任务管理功能。选择文章和平台后可以创建发布任务，测试任务的创建、进度更新、完成、失败等全流程。"
              type="info"
              showIcon
              style={{ marginBottom: '20px' }}
            />

            <Space style={{ marginBottom: '20px' }}>
              <Button icon={<ReloadOutlined />} onClick={refreshData}>
                刷新数据
              </Button>
            </Space>

            {/* 选择文章和平台 */}
            <div style={{ marginBottom: '20px' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <strong>选择文章：</strong>
                  <Select
                    style={{ width: 300, marginLeft: 10 }}
                    placeholder="请选择要发布的文章"
                    value={selectedArticle}
                    onChange={setSelectedArticle}
                  >
                    {articles.map(article => (
                      <Option key={article.id} value={article.id}>
                        {article.title} ({article.word_count}字)
                      </Option>
                    ))}
                  </Select>
                </div>
                <div>
                  <strong>选择平台：</strong>
                  <Select
                    style={{ width: 200, marginLeft: 10 }}
                    placeholder="请选择发布平台"
                    value={selectedPublishPlatform}
                    onChange={setSelectedPublishPlatform}
                  >
                    {platforms.map(platform => (
                      <Option key={platform.id} value={platform.id}>
                        {platform.display_name}
                      </Option>
                    ))}
                  </Select>
                </div>
                <Button
                  type="primary"
                  icon={<RocketOutlined />}
                  onClick={testCreatePublishTask}
                  loading={publishLoading}
                  disabled={!selectedPublishPlatform}
                >
                  创建发布任务
                </Button>
                <Button
                  icon={<PlayCircleOutlined />}
                  onClick={testStartPublishTask}
                  loading={publishLoading}
                  disabled={!currentPublishTask || currentPublishTask.status !== 0}
                >
                  启动发布任务
                </Button>
              </Space>
            </div>

            {/* 当前任务状态 */}
            {currentPublishTask && (
              <Card
                title={`当前任务：${currentPublishTask.id}`}
                style={{ marginBottom: '20px' }}
                size="small"
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <strong>状态：</strong>
                    <Tag color="blue">{currentPublishTask.status}</Tag>
                  </div>
                  <div>
                    <strong>进度：</strong>
                    <Progress
                      percent={currentPublishTask.progress}
                      size="small"
                      status={currentPublishTask.status === 3 ? 'exception' : 'active'}
                    />
                  </div>
                  <div>
                    <strong>消息：</strong>
                    {currentPublishTask.message || '无'}
                  </div>
                  <Space>
                    <Button
                      size="small"
                      onClick={testUpdateProgress}
                      disabled={currentPublishTask.status !== 1}
                    >
                      模拟进度+20%
                    </Button>
                    <Button
                      size="small"
                      type="primary"
                      onClick={testCompleteTask}
                      disabled={currentPublishTask.status !== 1}
                    >
                      模拟完成
                    </Button>
                    <Button
                      size="small"
                      danger
                      onClick={testFailTask}
                      disabled={currentPublishTask.status !== 1}
                    >
                      模拟失败
                    </Button>
                    <Button
                      size="small"
                      onClick={() => fetchTaskLogs(currentPublishTask.id)}
                    >
                      查看日志
                    </Button>
                  </Space>
                </Space>
              </Card>
            )}

            <Divider />
            <h4>发布任务列表</h4>
            <Table
              dataSource={publishTasks}
              columns={publishTaskColumns}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>

          {/* 发布统计 */}
          {publishStats && (
            <Card title="发布统计信息" style={{ marginBottom: '20px' }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <div><strong>总任务数：</strong>{publishStats.totalTasks}</div>
                <div><strong>活跃任务数：</strong>{publishStats.activeTasks}</div>
                <div><strong>状态分布：</strong>
                  {Object.entries(publishStats.statusDistribution || {}).map(([status, count]) => (
                    <Tag key={status} style={{ marginRight: 5 }}>
                      {status}: {count}
                    </Tag>
                  ))}
                </div>
              </Space>
            </Card>
          )}

          {/* 任务日志 */}
          {publishLogs.length > 0 && (
            <Card title="任务日志">
              <List
                dataSource={publishLogs}
                renderItem={log => (
                  <List.Item>
                    <Space>
                      <Tag color={log.level === 'error' ? 'red' : log.level === 'warn' ? 'orange' : 'blue'}>
                        {log.level}
                      </Tag>
                      <span>{new Date(log.created_at).toLocaleString()}</span>
                      <span>{log.message}</span>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          )}
        </TabPane>
      </Tabs>

      {/* 二维码模态框 */}
      <Modal
        title="扫码登录"
        open={qrModalVisible}
        onCancel={() => setQrModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setQrModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={400}
      >
        {qrCodeData && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              margin: '0 0 16px 0',
              padding: '12px',
              backgroundColor: '#e6f7ff',
              border: '1px solid #91d5ff',
              borderRadius: '6px'
            }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#1890ff' }}>
                📱 重要提示
              </p>
              <p style={{ margin: '0', fontSize: '14px', color: '#333' }}>
                请<strong>优先扫描Chrome浏览器中的二维码</strong>，这个是最清晰的原始二维码
              </p>
            </div>

            {qrCodeData.data && qrCodeData.data.startsWith('data:image') ? (
              <img
                src={qrCodeData.data}
                alt="登录二维码"
                style={{
                  width: '200px',
                  height: '200px',
                  border: '1px solid #d9d9d9',
                  borderRadius: '8px'
                }}
              />
            ) : (
              <QRCode
                value={qrCodeData.data || 'loading...'}
                size={200}
              />
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default TestPage;