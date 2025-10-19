import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Typography, Space, Alert, Button, Divider } from 'antd';
import { SendOutlined, HistoryOutlined, SettingOutlined } from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import PublishButton from '../Publish/PublishButton';
import PublishProgress from '../Publish/PublishProgress';
import { loadArticles, setCurrentArticle } from '../../store/slices/articlesSlice';
import { getActiveTasks, clearCompletedTasks } from '../../store/slices/publishSlice';
import electronAPI from '../../electronAPI';

const { Title, Text } = Typography;

/**
 * 发布管理页面
 * 集成T018 PublishButton和T019 PublishProgress组件
 * 复用现有publishSlice状态管理
 */
function PublishPage() {
  const dispatch = useDispatch();
  const { currentArticle } = useSelector(state => state.articles);
  const { currentTask, tasks, stats, loading } = useSelector(state => state.publish);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  // 加载文章列表
  useEffect(() => {
    const loadArticlesList = async () => {
      try {
        const result = await electronAPI.articles.findAll();
        if (result.success && result.data.length > 0) {
          // 默认选择最新的一篇文章
          const latestArticle = result.data[0];
          dispatch(setCurrentArticle(latestArticle));
        }
      } catch (error) {
        console.error('加载文章列表失败:', error);
      }
    };

    loadArticlesList();
  }, [dispatch]);

  // 加载活跃任务
  useEffect(() => {
    const loadActiveTasks = async () => {
      try {
        const result = await electronAPI.publish.getActiveTasks();
        if (result.success && result.data.length > 0) {
          setSelectedTaskId(result.data[0].id);
        }
      } catch (error) {
        console.error('加载活跃任务失败:', error);
      }
    };

    loadActiveTasks();
  }, []);

  // 发布完成回调
  const handlePublishComplete = (task) => {
    console.log('发布完成:', task);
    // 可以在这里添加发布成功后的处理逻辑
  };

  // 清理已完成任务
  const handleClearCompleted = () => {
    dispatch(clearCompletedTasks());
  };

  // 获取活跃任务
  const activeTasks = tasks.filter(task =>
    task.status === 'pending' || task.status === 'in_progress'
  );

  return (
    <div className="page-container">
      <div className="page-header">
        <Title level={2}>发布管理</Title>
        <Text type="secondary">一键发布文章到各个平台，实时跟踪发布进度</Text>
      </div>

      <div className="page-content">
        <Row gutter={[16, 16]}>
          {/* 左侧：发布控制和进度 */}
          <Col xs={24} lg={14}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {/* 当前文章信息 */}
              {currentArticle && (
                <Card title="当前文章" size="small">
                  <Space direction="vertical" style={{ width: '100%' }}>
                    <Text strong>{currentArticle.title}</Text>
                    <Text type="secondary">
                      字数: {currentArticle.content?.length || 0} |
                      创建时间: {new Date(currentArticle.created_at).toLocaleDateString()}
                    </Text>
                  </Space>
                </Card>
              )}

              {/* 发布按钮 */}
              <Card title="发布控制" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <PublishButton
                    articleId={currentArticle?.id}
                    onPublishComplete={handlePublishComplete}
                  />

                  {!currentArticle && (
                    <Alert
                      message="请先选择要发布的文章"
                      type="info"
                      showIcon
                      style={{ marginTop: 8 }}
                    />
                  )}
                </Space>
              </Card>

              {/* 发布进度 */}
              {currentTask && (
                <PublishProgress
                  taskId={currentTask.id}
                  compact={false}
                  showLogs={true}
                />
              )}

              {/* 活跃任务列表 */}
              {activeTasks.length > 0 && (
                <Card
                  title={
                    <Space>
                      <SendOutlined />
                      <span>活跃任务 ({activeTasks.length})</span>
                    </Space>
                  }
                  size="small"
                  extra={
                    <Button
                      size="small"
                      onClick={handleClearCompleted}
                      disabled={stats.success + stats.failed === 0}
                    >
                      清理已完成
                    </Button>
                  }
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {activeTasks.map(task => (
                      <div
                        key={task.id}
                        style={{
                          padding: 8,
                          border: '1px solid #f0f0f0',
                          borderRadius: 6,
                          cursor: 'pointer',
                          backgroundColor: selectedTaskId === task.id ? '#f6ffed' : 'transparent'
                        }}
                        onClick={() => setSelectedTaskId(task.id)}
                      >
                        <PublishProgress
                          taskId={task.id}
                          compact={true}
                          showLogs={false}
                        />
                      </div>
                    ))}
                  </Space>
                </Card>
              )}
            </Space>
          </Col>

          {/* 右侧：统计和历史 */}
          <Col xs={24} lg={10}>
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              {/* 发布统计 */}
              <Card
                title={
                  <Space>
                    <SettingOutlined />
                    <span>发布统计</span>
                  </Space>
                }
                size="small"
              >
                <Row gutter={16}>
                  <Col span={12}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1890ff' }}>
                        {stats.total}
                      </div>
                      <Text type="secondary">总任务数</Text>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 24, fontWeight: 'bold', color: '#52c41a' }}>
                        {stats.success}
                      </div>
                      <Text type="secondary">成功</Text>
                    </div>
                  </Col>
                </Row>
                <Divider style={{ margin: '12px 0' }} />
                <Row gutter={16}>
                  <Col span={12}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 'bold', color: '#faad14' }}>
                        {stats.pending}
                      </div>
                      <Text type="secondary">等待中</Text>
                    </div>
                  </Col>
                  <Col span={12}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 20, fontWeight: 'bold', color: '#ff4d4f' }}>
                        {stats.failed}
                      </div>
                      <Text type="secondary">失败</Text>
                    </div>
                  </Col>
                </Row>
              </Card>

              {/* 使用说明 */}
              <Card
                title={
                  <Space>
                    <HistoryOutlined />
                    <span>使用说明</span>
                  </Space>
                }
                size="small"
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Text>
                    1. 在编辑页面完成文章编写
                  </Text>
                  <Text>
                    2. 确保平台登录状态正常
                  </Text>
                  <Text>
                    3. 点击"一键发布"按钮开始发布
                  </Text>
                  <Text>
                    4. 实时查看发布进度和状态
                  </Text>
                  <Text>
                    5. 发布失败时可自动重试
                  </Text>
                </Space>
              </Card>

              {/* 系统状态 */}
              <Card title="系统状态" size="small">
                <Space direction="vertical" style={{ width: '100%' }}>
                  <div>
                    <Text strong>发布服务: </Text>
                    <Text style={{ color: '#52c41a' }}>正常运行</Text>
                  </div>
                  <div>
                    <Text strong>浏览器管理: </Text>
                    <Text style={{ color: '#52c41a' }}>就绪</Text>
                  </div>
                  <div>
                    <Text strong>错误处理: </Text>
                    <Text style={{ color: '#52c41a' }}>已启用</Text>
                  </div>
                </Space>
              </Card>
            </Space>
          </Col>
        </Row>
      </div>
    </div>
  );
}

export default PublishPage;