import React, { useState, useEffect } from 'react';
import { Card, Steps, Progress, Space, Typography, Tag, Button, Tooltip, Timeline, Alert } from 'antd';
import {
  CheckCircleOutlined,
  LoadingOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { updatePublishTask, clearCurrentTask } from '../../store/slices/publishSlice';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;

/**
 * 发布进度跟踪组件
 * 实现T019：发布进度跟踪
 * 复用publishSlice状态管理和实时进度更新
 */
function PublishProgress({ taskId, compact = false, showLogs = true }) {
  const dispatch = useDispatch();
  const { tasks, currentTask } = useSelector(state => state.publish);
  const [estimatedTime, setEstimatedTime] = useState(0);

  // 获取任务信息
  const task = taskId ? tasks.find(t => t.id === taskId) : currentTask;

  // 发布步骤定义
  const publishSteps = [
    {
      title: '准备发布',
      description: '验证文章内容',
      icon: <InfoCircleOutlined />,
      status: 'process'
    },
    {
      title: '登录验证',
      description: '检查平台登录状态',
      icon: <SyncOutlined />,
      status: 'process'
    },
    {
      title: '内容填充',
      description: '填写标题和正文',
      icon: <LoadingOutlined />,
      status: 'process'
    },
    {
      title: '发布执行',
      description: '提交到平台',
      icon: <LoadingOutlined />,
      status: 'process'
    },
    {
      title: '结果验证',
      description: '确认发布成功',
      icon: <CheckCircleOutlined />,
      status: 'process'
    }
  ];

  // 计算当前步骤
  const getCurrentStep = () => {
    if (!task) return 0;

    const progress = task.progress || 0;
    if (progress < 20) return 0;        // 准备发布
    if (progress < 40) return 1;        // 登录验证
    if (progress < 70) return 2;        // 内容填充
    if (progress < 90) return 3;        // 发布执行
    return 4;                           // 结果验证
  };

  // 获取步骤状态
  const getStepStatus = (stepIndex) => {
    if (!task) return 'wait';

    const currentStep = getCurrentStep();

    if (task.status === 'failed') {
      return stepIndex === currentStep ? 'error' : 'wait';
    }

    if (task.status === 'success') {
      return 'finish';
    }

    if (stepIndex < currentStep) return 'finish';
    if (stepIndex === currentStep) return 'process';
    return 'wait';
  };

  // 计算预估剩余时间
  useEffect(() => {
    if (!task || task.status === 'success' || task.status === 'failed') {
      setEstimatedTime(0);
      return;
    }

    const progress = task.progress || 0;
    const remainingProgress = 100 - progress;

    // 基于历史数据计算平均速度（简化版本：假设每秒完成2%进度）
    const avgSpeed = 2; // percent per second
    const estimatedSeconds = remainingProgress / avgSpeed;
    setEstimatedTime(Math.ceil(estimatedSeconds));
  }, [task]);

  // 格式化时间显示
  const formatTime = (seconds) => {
    if (seconds < 60) return `${seconds}秒`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  // 获取状态标签
  const getStatusTag = () => {
    if (!task) return <Tag color="default">未开始</Tag>;

    switch (task.status) {
      case 'pending':
        return <Tag color="blue">等待中</Tag>;
      case 'in_progress':
        return <Tag color="processing" icon={<SyncOutlined spin />}>进行中</Tag>;
      case 'success':
        return <Tag color="success" icon={<CheckCircleOutlined />}>成功</Tag>;
      case 'failed':
        return <Tag color="error" icon={<ExclamationCircleOutlined />}>失败</Tag>;
      default:
        return <Tag color="default">未知</Tag>;
    }
  };

  // 获取进度条状态
  const getProgressStatus = () => {
    if (!task) return 'normal';
    if (task.status === 'failed') return 'exception';
    if (task.status === 'success') return 'success';
    return 'active';
  };

  // 渲染紧凑模式
  if (compact) {
    return (
      <Card size="small" style={{ width: '100%' }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              {getStatusTag()}
              <Text strong>发布进度</Text>
            </Space>
            <Text type="secondary">
              {task?.progress || 0}%
            </Text>
          </Space>

          <Progress
            percent={task?.progress || 0}
            status={getProgressStatus()}
            size="small"
            strokeColor={{
              '0%': '#108ee9',
              '100%': '#52c41a',
            }}
          />

          {estimatedTime > 0 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              预计剩余时间: {formatTime(estimatedTime)}
            </Text>
          )}
        </Space>
      </Card>
    );
  }

  // 渲染完整模式
  return (
    <Card title="发布进度跟踪" style={{ width: '100%' }}>
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 头部信息 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            {getStatusTag()}
            <Title level={4} style={{ margin: 0 }}>
              {task?.status === 'success' ? '发布完成' :
               task?.status === 'failed' ? '发布失败' : '正在发布'}
            </Title>
          </Space>

          {task && (
            <Space>
              <Text type="secondary">
                开始时间: {new Date(task.createdAt).toLocaleTimeString()}
              </Text>
              {estimatedTime > 0 && (
                <Tooltip title="基于当前进度预估">
                  <Text type="secondary">
                    <ClockCircleOutlined /> 预计剩余: {formatTime(estimatedTime)}
                  </Text>
                </Tooltip>
              )}
            </Space>
          )}
        </div>

        {/* 步骤指示器 */}
        <Steps
          current={getCurrentStep()}
          size="small"
          style={{ marginBottom: 20 }}
        >
          {publishSteps.map((step, index) => (
            <Step
              key={index}
              title={step.title}
              description={step.description}
              status={getStepStatus(index)}
              icon={step.status === 'error' ? <ExclamationCircleOutlined /> : step.icon}
            />
          ))}
        </Steps>

        {/* 进度条 */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <Text strong>总体进度</Text>
            <Text>{task?.progress || 0}%</Text>
          </div>
          <Progress
            percent={task?.progress || 0}
            status={getProgressStatus()}
            strokeColor={{
              '0%': '#108ee9',
              '50%': '#faad14',
              '100%': '#52c41a',
            }}
            strokeWidth={8}
          />
        </div>

        {/* 状态信息 */}
        {task?.status === 'failed' && (
          <Alert
            message="发布失败"
            description={task.error || '未知错误，请重试'}
            type="error"
            showIcon
            closable
          />
        )}

        {task?.status === 'success' && (
          <Alert
            message="发布成功"
            description={
              <Space direction="vertical">
                <Text>文章已成功发布到平台</Text>
                {task.publishedUrl && (
                  <Text copyable={{ text: task.publishedUrl }}>
                    <a href={task.publishedUrl} target="_blank" rel="noopener noreferrer">
                      查看文章
                    </a>
                  </Text>
                )}
                <Text type="secondary">
                  完成时间: {new Date(task.updatedAt).toLocaleString()}
                </Text>
              </Space>
            }
            type="success"
            showIcon
          />
        )}

        {/* 发布日志 */}
        {showLogs && task?.logs && task.logs.length > 0 && (
          <Card size="small" title="发布日志" style={{ marginTop: 16 }}>
            <div style={{ maxHeight: 200, overflowY: 'auto' }}>
              <Timeline mode="left" size="small">
                {task.logs.map((log, index) => (
                  <Timeline.Item
                    key={index}
                    color={
                      log.level === 'error' ? 'red' :
                      log.level === 'warn' ? 'orange' :
                      log.level === 'info' ? 'blue' : 'gray'
                    }
                    dot={
                      log.level === 'error' ? <ExclamationCircleOutlined /> :
                      log.level === 'warn' ? <InfoCircleOutlined /> :
                      log.level === 'info' ? <CheckCircleOutlined /> : <ClockCircleOutlined />
                    }
                  >
                    <div>
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </Text>
                      <br />
                      <Text style={{ fontSize: 13 }}>{log.message}</Text>
                    </div>
                  </Timeline.Item>
                ))}
              </Timeline>
            </div>
          </Card>
        )}

        {/* 操作按钮 */}
        <div style={{ textAlign: 'right' }}>
          {task?.status === 'failed' && (
            <Button type="primary" danger>
              重试发布
            </Button>
          )}
          {task?.status === 'success' && (
            <Button type="primary" onClick={() => dispatch(clearCurrentTask())}>
              完成
            </Button>
          )}
        </div>
      </Space>
    </Card>
  );
}

export default PublishProgress;