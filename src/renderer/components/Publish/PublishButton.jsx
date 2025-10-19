import React, { useState, useEffect } from 'react';
import { Button, Modal, Progress, Card, Space, Typography, message, Divider } from 'antd';
import { SendOutlined, LoadingOutlined, CheckCircleOutlined, ExclamationCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { publishArticle, retryPublish, clearCurrentTask, updateSettings } from '../../store/slices/publishSlice';
import electronAPI from '../../electronAPI';

const { Title, Text, Paragraph } = Typography;

/**
 * 一键发布按钮组件
 * 实现T018：一键发布UI界面
 * 复用publishSlice状态管理和PublishService服务
 */
function PublishButton({ articleId, onPublishComplete }) {
  const dispatch = useDispatch();
  const {
    currentTask,
    loading,
    publishing,
    error,
    settings
  } = useSelector(state => state.publish);
  const { currentArticle } = useSelector(state => state.articles);

  const [showModal, setShowModal] = useState(false);
  const [publishConfig, setPublishConfig] = useState({
    platforms: ['zhihu'], // 默认只发布到知乎（MVP）
    autoRetry: true,
    concurrentPublish: false
  });

  // 发布文章
  const handlePublish = async () => {
    if (!articleId) {
      message.error('请先选择要发布的文章');
      return;
    }

    try {
      // 检查文章内容（使用当前编辑器的文章数据）
      const article = currentArticle;
      if (!article) {
        message.error('文章不存在');
        return;
      }

      if (!article.title || !article.html_content) {
        message.error('文章标题或内容不能为空');
        return;
      }

      // 开始发布
      const result = await dispatch(publishArticle({
        articleId,
        platformIds: publishConfig.platforms,
        config: publishConfig
      })).unwrap();

      setShowModal(true);
      message.success('发布任务已创建');

    } catch (error) {
      console.error('发布失败:', error);
      message.error(`发布失败: ${error.message || '未知错误'}`);
    }
  };

  // 重试发布
  const handleRetry = async () => {
    if (!currentTask) return;

    try {
      await dispatch(retryPublish({ taskId: currentTask.id })).unwrap();
      message.info('正在重试发布...');
    } catch (error) {
      console.error('重试失败:', error);
      message.error(`重试失败: ${error.message || '未知错误'}`);
    }
  };

  // 关闭模态框
  const handleCloseModal = () => {
    setShowModal(false);
    dispatch(clearCurrentTask());

    // 通知父组件发布完成
    if (onPublishComplete && currentTask?.status === 'success') {
      onPublishComplete(currentTask);
    }
  };

  // 更新配置
  const handleConfigChange = (key, value) => {
    setPublishConfig(prev => ({ ...prev, [key]: value }));
    dispatch(updateSettings({ [key]: value }));
  };

  // 获取发布状态图标
  const getStatusIcon = () => {
    if (loading) return <LoadingOutlined />;
    if (currentTask?.status === 'success') return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    if (currentTask?.status === 'failed') return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
    return <SendOutlined />;
  };

  // 获取发布状态文本
  const getStatusText = () => {
    if (loading) return '发布中...';
    if (currentTask?.status === 'success') return '发布成功';
    if (currentTask?.status === 'failed') return '发布失败';
    return '一键发布';
  };

  // 获取进度百分比
  const getProgressPercent = () => {
    if (!currentTask) return 0;
    return currentTask.progress || 0;
  };

  // 渲染发布状态模态框
  const renderPublishModal = () => {
    if (!currentTask) return null;

    return (
      <Modal
        title={
          <Space>
            {getStatusIcon()}
            <span>发布状态</span>
          </Space>
        }
        open={showModal}
        onCancel={handleCloseModal}
        footer={[
          currentTask?.status === 'failed' && (
            <Button
              key="retry"
              type="primary"
              icon={<ReloadOutlined />}
              onClick={handleRetry}
              loading={loading}
            >
              重试发布
            </Button>
          ),
          <Button key="close" onClick={handleCloseModal}>
            {currentTask?.status === 'success' ? '完成' : '关闭'}
          </Button>
        ]}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 进度条 */}
          <Card size="small">
            <Title level={5}>发布进度</Title>
            <Progress
              percent={getProgressPercent()}
              status={currentTask?.status === 'failed' ? 'exception' : 'active'}
              strokeColor={{
                '0%': '#108ee9',
                '100%': '#52c41a',
              }}
            />
            <Text type="secondary">
              {currentTask?.progress || 0}% 完成
            </Text>
          </Card>

          {/* 发布结果 */}
          {currentTask?.status === 'success' && (
            <Card size="small">
              <Title level={5}>发布结果</Title>
              <Space direction="vertical">
                <Text strong>发布成功！</Text>
                {currentTask?.publishedUrl && (
                  <Paragraph copyable>
                    <a href={currentTask.publishedUrl} target="_blank" rel="noopener noreferrer">
                      {currentTask.publishedUrl}
                    </a>
                  </Paragraph>
                )}
                <Text type="secondary">
                  发布时间: {new Date(currentTask.updatedAt).toLocaleString()}
                </Text>
              </Space>
            </Card>
          )}

          {/* 错误信息 */}
          {currentTask?.status === 'failed' && (
            <Card size="small">
              <Title level={5}>错误信息</Title>
              <Text type="danger">{currentTask?.error || '未知错误'}</Text>
            </Card>
          )}

          {/* 发布日志 */}
          {currentTask?.logs && currentTask.logs.length > 0 && (
            <Card size="small">
              <Title level={5}>发布日志</Title>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {currentTask.logs.map((log, index) => (
                  <div key={index} style={{ marginBottom: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </Text>
                    <Text
                      style={{
                        marginLeft: 8,
                        fontSize: 12,
                        color: log.level === 'error' ? '#ff4d4f' : log.level === 'warn' ? '#faad14' : '#666'
                      }}
                    >
                      {log.message}
                    </Text>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </Space>
      </Modal>
    );
  };

  return (
    <>
      <Button
        type="primary"
        size="large"
        icon={getStatusIcon()}
        loading={loading}
        onClick={handlePublish}
        disabled={!articleId || publishing}
        style={{
          height: 48,
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(24, 144, 255, 0.2)',
        }}
      >
        {getStatusText()}
      </Button>

      {/* 发布状态模态框 */}
      {renderPublishModal()}
    </>
  );
}

export default PublishButton;