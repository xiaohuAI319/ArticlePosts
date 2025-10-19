/**
 * T019 PublishProgress组件测试
 * 发布进度跟踪组件的测试驱动开发
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import PublishProgress from '../../../../src/renderer/components/Publish/PublishProgress.jsx';
import publishSlice from '../../../../src/renderer/store/slices/publishSlice.js';

// 模拟依赖
jest.mock('antd', () => ({
  Card: ({ title, children, size, extra, className, styles }) => (
    <div data-testid="card" data-size={size} className={className} style={styles?.body}>
      <div data-testid="card-title">{title}</div>
      <div data-testid="card-extra">{extra}</div>
      <div data-testid="card-content">{children}</div>
    </div>
  ),
  Steps: ({ current, items, direction, size }) => (
    <div data-testid="steps" data-current={current} data-direction={direction} data-size={size}>
      {items?.map((item, index) => (
        <div
          key={index}
          data-testid={`step-${index}`}
          data-status={index === current ? 'process' : index < current ? 'finish' : 'wait'}
        >
          <div data-testid={`step-${index}-title`}>{item.title}</div>
          <div data-testid={`step-${index}-description`}>{item.description}</div>
        </div>
      ))}
    </div>
  ),
  Progress: ({ percent, status, format, strokeWidth, strokeColor, showInfo }) => (
    <div
      data-testid="progress-bar"
      data-percent={percent}
      data-status={status}
      data-stroke-width={strokeWidth}
      data-show-info={showInfo}
    >
      {showInfo && <div data-testid="progress-text">{format ? format(percent) : `${percent}%`}</div>}
    </div>
  ),
  Timeline: ({ items, mode, reverse }) => (
    <div data-testid="timeline" data-mode={mode} data-reverse={reverse}>
      {items?.map((item, index) => (
        <div key={index} data-testid={`timeline-item-${index}`} data-color={item.color}>
          <div data-testid={`timeline-item-${index}-time`}>{item.time}</div>
          <div data-testid={`timeline-item-${index}-content`}>{item.children}</div>
        </div>
      ))}
    </div>
  ),
  Space: ({ children, direction, size, split }) => (
    <div data-testid="space" data-direction={direction} data-size={size} data-split={split}>
      {children}
    </div>
  ),
  Typography: {
    Text: ({ children, type, ...props }) => (
      <span data-testid="text" data-type={type} {...props}>{children}</span>
    ),
    Title: ({ children, level, ...props }) => (
      <h1 data-testid="title" data-level={level} {...props}>{children}</h1>
    ),
    Paragraph: ({ children, ...props }) => (
      <p data-testid="paragraph" {...props}>{children}</p>
    )
  },
  Tag: ({ children, color, icon }) => (
    <span data-testid="tag" data-color={color}>
      {icon && <span data-testid="tag-icon">{icon}</span>}
      {children}
    </span>
  ),
  Button: ({ children, onClick, type, size, icon, loading, disabled }) => (
    <button
      onClick={onClick}
      type={type}
      disabled={disabled || loading}
      data-testid={icon ? `${icon}-button` : 'button'}
      data-loading={loading}
      data-size={size}
    >
      {loading ? '处理中...' : children}
    </button>
  ),
  Spin: ({ spinning, size, tip, children }) => (
    <div data-testid="spin" data-spinning={spinning} data-size={size} data-tip={tip}>
      {spinning ? <div data-testid="spinner">{tip || '加载中...'}</div> : children}
    </div>
  ),
  Tooltip: ({ title, children, placement }) => (
    <div data-testid="tooltip" data-title={title} data-placement={placement}>
      {children}
    </div>
  ),
  Badge: ({ count, status, text, children }) => (
    <div data-testid="badge" data-count={count} data-status={status} data-text={text}>
      {children}
    </div>
  ),
  Statistic: ({ title, value, suffix, prefix }) => (
    <div data-testid="statistic">
      <div data-testid="statistic-title">{title}</div>
      <div data-testid="statistic-value">
        {prefix && <span data-testid="statistic-prefix">{prefix}</span>}
        {value}
        {suffix && <span data-testid="statistic-suffix">{suffix}</span>}
      </div>
    </div>
  ),
  Row: ({ gutter, children }) => (
    <div data-testid="row" data-gutter={gutter}>
      {children}
    </div>
  ),
  Col: ({ span, children }) => (
    <div data-testid="col" data-span={span}>
      {children}
    </div>
  )
}));

// 模拟图标
jest.mock('@ant-design/icons', () => ({
  CheckCircleOutlined: () => <span data-testid="check-circle-icon">✓</span>,
  ClockCircleOutlined: () => <span data-testid="clock-circle-icon">⏰</span>,
  ExclamationCircleOutlined: () => <span data-testid="exclamation-circle-icon">⚠</span>,
  SyncOutlined: ({ spin }) => <span data-testid="sync-icon" data-spin={spin}>🔄</span>,
  EyeOutlined: () => <span data-testid="eye-icon">👁</span>,
  ReloadOutlined: () => <span data-testid="reload-icon">🔄</span>,
  CloseOutlined: () => <span data-testid="close-icon">✕</span>,
  InfoCircleOutlined: () => <span data-testid="info-circle-icon">ℹ</span>,
  WarningOutlined: () => <span data-testid="warning-icon">⚠</span>,
  LoadingOutlined: () => <span data-testid="loading-icon">⏳</span>
}));

// 模拟electronAPI
const mockElectronAPI = {
  publish: {
    getTaskById: jest.fn(),
    getTaskLogs: jest.fn(),
    cancelTask: jest.fn(),
    retryTask: jest.fn()
  }
};

global.window = {
  electronAPI: mockElectronAPI
};

// 创建测试store
function createTestStore(initialState = {}) {
  return configureStore({
    reducer: {
      publish: publishSlice
    },
    preloadedState: {
      publish: {
        isPublishing: false,
        currentTask: null,
        tasks: [],
        history: [],
        stats: {
          total: 0,
          pending: 0,
          inProgress: 0,
          success: 0,
          failed: 0
        },
        error: null,
        ...initialState.publish
      }
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false
      })
  });
}

// 测试工具函数
function renderWithStore(component, store = createTestStore()) {
  return {
    ...render(
      <Provider store={store}>
        {component}
      </Provider>
    ),
    store
  };
}

// 创建测试任务数据
const createMockTask = (overrides = {}) => ({
  id: 1,
  articleId: 1,
  articleTitle: '测试文章',
  platformIds: ['zhihu'],
  config: {
    platforms: ['zhihu'],
    publishTime: 'immediate',
    tags: ['测试']
  },
  status: 'pending',
  progress: 0,
  currentStep: 0,
  totalSteps: 5,
  startTime: null,
  endTime: null,
  results: [],
  logs: [],
  retryCount: 0,
  maxRetries: 3,
  error: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides
});

describe('T019 PublishProgress组件', () => {
  let store;
  let mockTask;

  beforeEach(() => {
    jest.clearAllMocks();
    store = createTestStore();
    mockTask = createMockTask();
  });

  describe('组件渲染测试', () => {
    test('应该正确渲染进度组件', () => {
      renderWithStore(<PublishProgress taskId={1} />);

      expect(screen.getByTestId('card')).toBeInTheDocument();
      expect(screen.getByTestId('card-title')).toBeInTheDocument();
    });

    test('应该显示任务标题', async () => {
      mockTask.articleTitle = '我的测试文章';
      mockElectronAPI.publish.getTaskById.mockResolvedValue({
        success: true,
        data: mockTask
      });

      renderWithStore(<PublishProgress taskId={1} />);

      await waitFor(() => {
        expect(screen.getByText('我的测试文章')).toBeInTheDocument();
      });
    });

    test('应该在compact模式下显示简化布局', () => {
      renderWithStore(
        <PublishProgress taskId={1} compact={true} />
      );

      const card = screen.getByTestId('card');
      expect(card).toHaveClass('publish-progress-compact');
    });

    test('应该在禁用日志时不显示日志区域', () => {
      renderWithStore(
        <PublishProgress taskId={1} showLogs={false} />
      );

      expect(screen.queryByTestId('timeline')).not.toBeInTheDocument();
    });
  });

  describe('发布步骤显示测试', () => {
    test('应该显示5个发布步骤', async () => {
      mockElectronAPI.publish.getTaskById.mockResolvedValue({
        success: true,
        data: mockTask
      });

      renderWithStore(<PublishProgress taskId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('steps')).toBeInTheDocument();
        expect(screen.getByTestId('step-0')).toBeInTheDocument();
        expect(screen.getByTestId('step-4')).toBeInTheDocument();
      });
    });

    test('应该正确显示当前步骤', async () => {
      mockTask.currentStep = 2;
      mockTask.progress = 40;
      mockElectronAPI.publish.getTaskById.mockResolvedValue({
        success: true,
        data: mockTask
      });

      renderWithStore(<PublishProgress taskId={1} />);

      await waitFor(() => {
        const steps = screen.getByTestId('steps');
        expect(steps).toHaveAttribute('data-current', '2');

        // 验证当前步骤状态
        expect(screen.getByTestId('step-2')).toHaveAttribute('data-status', 'process');
        expect(screen.getByTestId('step-0')).toHaveAttribute('data-status', 'finish');
        expect(screen.getByTestId('step-1')).toHaveAttribute('data-status', 'finish');
        expect(screen.getByTestId('step-3')).toHaveAttribute('data-status', 'wait');
      });
    });

    test('应该显示步骤描述信息', async () => {
      mockElectronAPI.publish.getTaskById.mockResolvedValue({
        success: true,
        data: mockTask
      });

      renderWithStore(<PublishProgress taskId={1} />);

      await waitFor(() => {
        expect(screen.getByText('准备发布')).toBeInTheDocument();
        expect(screen.getByText('验证文章内容')).toBeInTheDocument();
        expect(screen.getByText('登录验证')).toBeInTheDocument();
        expect(screen.getByText('检查平台登录状态')).toBeInTheDocument();
        expect(screen.getByText('内容填充')).toBeInTheDocument();
        expect(screen.getByText('填写标题和正文')).toBeInTheDocument();
        expect(screen.getByText('发布执行')).toBeInTheDocument();
        expect(screen.getByText('提交到平台')).toBeInTheDocument();
        expect(screen.getByText('结果验证')).toBeInTheDocument();
        expect(screen.getByText('确认发布成功')).toBeInTheDocument();
      });
    });
  });

  describe('进度条显示测试', () => {
    test('应该显示正确的进度百分比', async () => {
      mockTask.progress = 65;
      mockElectronAPI.publish.getTaskById.mockResolvedValue({
        success: true,
        data: mockTask
      });

      renderWithStore(<PublishProgress taskId={1} />);

      await waitFor(() => {
        const progressBar = screen.getByTestId('progress-bar');
        expect(progressBar).toHaveAttribute('data-percent', '65');
      });
    });

    test('应该显示当前步骤信息', async () => {
      mockTask.currentStep = 3;
      mockTask.stepMessage = '正在填写文章内容...';
      mockElectronAPI.publish.getTaskById.mockResolvedValue({
        success: true,
        data: mockTask
      });

      renderWithStore(<PublishProgress taskId={1} />);

      await waitFor(() => {
        expect(screen.getByText('正在填写文章内容...')).toBeInTheDocument();
        expect(screen.getByText('第 3 / 5 步')).toBeInTheDocument();
      });
    });

    test('应该根据状态显示不同的进度条颜色', async () => {
      // 测试进行中状态
      mockTask.status = 'in_progress';
      mockElectronAPI.publish.getTaskById.mockResolvedValue({
        success: true,
        data: mockTask
      });

      renderWithStore(<PublishProgress taskId={1} />);

      await waitFor(() => {
        const progressBar = screen.getByTestId('progress-bar');
        expect(progressBar).toHaveAttribute('data-status', 'active');
      });
    });
  });

  describe('时间统计测试', () => {
    test('应该显示已用时间', async () => {
      const startTime = new Date(Date.now() - 30000); // 30秒前开始
      mockTask.startTime = startTime.toISOString();
      mockTask.status = 'in_progress';
      mockElectronAPI.publish.getTaskById.mockResolvedValue({
        success: true,
        data: mockTask
      });

      renderWithStore(<PublishProgress taskId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/已用时间/)).toBeInTheDocument();
        expect(screen.getByText(/0:0:/)).toBeInTheDocument();
      });
    });

    test('应该显示预估剩余时间', async () => {
      mockTask.startTime = new Date(Date.now() - 20000).toISOString(); // 20秒前开始
      mockTask.progress = 25; // 完成25%
      mockTask.status = 'in_progress';
      mockElectronAPI.publish.getTaskById.mockResolvedValue({
        success: true,
        data: mockTask
      });

      renderWithStore(<PublishProgress taskId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/预估剩余/)).toBeInTheDocument();
      });
    });

    test('完成后应该显示总用时', async () => {
      const startTime = new Date(Date.now() - 120000); // 2分钟前开始
      const endTime = new Date();
      mockTask.startTime = startTime.toISOString();
      mockTask.endTime = endTime.toISOString();
      mockTask.status = 'completed';
      mockElectronAPI.publish.getTaskById.mockResolvedValue({
        success: true,
        data: mockTask
      });

      renderWithStore(<PublishProgress taskId={1} />);

      await waitFor(() => {
        expect(screen.getByText(/总用时/)).toBeInTheDocument();
        expect(screen.getByText(/2:0/)).toBeInTheDocument();
      });
    });
  });

  describe('日志显示测试', () => {
    test('应该显示任务日志', async () => {
      const logs = [
        { id: 1, time: '2025-10-16 20:00:00', level: 'info', message: '开始发布任务' },
        { id: 2, time: '2025-10-16 20:00:05', level: 'info', message: '验证文章内容成功' },
        { id: 3, time: '2025-10-16 20:00:10', level: 'warning', message: '登录状态即将过期' }
      ];

      mockElectronAPI.publish.getTaskLogs.mockResolvedValue({
        success: true,
        data: logs
      });

      renderWithStore(<PublishProgress taskId={1} showLogs={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('timeline')).toBeInTheDocument();
        expect(screen.getByText('开始发布任务')).toBeInTheDocument();
        expect(screen.getByText('验证文章内容成功')).toBeInTheDocument();
        expect(screen.getByText('登录状态即将过期')).toBeInTheDocument();
      });
    });

    test('应该根据日志级别显示不同颜色', async () => {
      const logs = [
        { id: 1, time: '2025-10-16 20:00:00', level: 'error', message: '发布失败' },
        { id: 2, time: '2025-10-16 20:00:05', level: 'success', message: '发布成功' },
        { id: 3, time: '2025-10-16 20:00:10', level: 'info', message: '任务完成' }
      ];

      mockElectronAPI.publish.getTaskLogs.mockResolvedValue({
        success: true,
        data: logs
      });

      renderWithStore(<PublishProgress taskId={1} showLogs={true} />);

      await waitFor(() => {
        expect(screen.getByTestId('timeline-item-0')).toHaveAttribute('data-color', 'red');
        expect(screen.getByTestId('timeline-item-1')).toHaveAttribute('data-color', 'green');
        expect(screen.getByTestId('timeline-item-2')).toHaveAttribute('data-color', 'blue');
      });
    });

    test('应该能够实时更新日志', async () => {
      const initialLogs = [
        { id: 1, time: '2025-10-16 20:00:00', level: 'info', message: '开始发布任务' }
      ];

      const updatedLogs = [
        ...initialLogs,
        { id: 2, time: '2025-10-16 20:00:05', level: 'info', message: '验证文章内容成功' }
      ];

      mockElectronAPI.publish.getTaskLogs
        .mockResolvedValueOnce({ success: true, data: initialLogs })
        .mockResolvedValueOnce({ success: true, data: updatedLogs });

      renderWithStore(<PublishProgress taskId={1} showLogs={true} />);

      await waitFor(() => {
        expect(screen.getByText('开始发布任务')).toBeInTheDocument();
      });

      // 触发日志更新
      fireEvent.click(screen.getByTestId('reload-icon-button'));

      await waitFor(() => {
        expect(screen.getByText('验证文章内容成功')).toBeInTheDocument();
      });
    });
  });

  describe('状态管理测试', () => {
    test('应该处理加载状态', () => {
      renderWithStore(<PublishProgress taskId={1} />);

      expect(screen.getByTestId('spin')).toBeInTheDocument();
      expect(screen.getByTestId('spinner')).toBeInTheDocument();
    });

    test('应该处理错误状态', async () => {
      mockElectronAPI.publish.getTaskById.mockResolvedValue({
        success: false,
        message: '任务不存在'
      });

      renderWithStore(<PublishProgress taskId={1} />);

      await waitFor(() => {
        expect(screen.getByText('任务不存在')).toBeInTheDocument();
      });
    });

    test('应该处理网络错误', async () => {
      mockElectronAPI.publish.getTaskById.mockRejectedValue(
        new Error('网络连接失败')
      );

      renderWithStore(<PublishProgress taskId={1} />);

      await waitFor(() => {
        expect(screen.getByText('加载任务信息失败')).toBeInTheDocument();
        expect(screen.getByText('网络连接失败')).toBeInTheDocument();
      });
    });
  });

  describe('交互功能测试', () => {
    test('应该能够取消发布任务', async () => {
      mockTask.status = 'in_progress';
      mockElectronAPI.publish.getTaskById.mockResolvedValue({
        success: true,
        data: mockTask
      });
      mockElectronAPI.publish.cancelTask.mockResolvedValue({
        success: true
      });

      renderWithStore(<PublishProgress taskId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('close-icon-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('close-icon-button'));

      await waitFor(() => {
        expect(mockElectronAPI.publish.cancelTask).toHaveBeenCalledWith(1);
      });
    });

    test('应该能够重试失败的任务', async () => {
      mockTask.status = 'failed';
      mockTask.error = '登录失败';
      mockElectronAPI.publish.getTaskById.mockResolvedValue({
        success: true,
        data: mockTask
      });
      mockElectronAPI.publish.retryTask.mockResolvedValue({
        success: true
      });

      renderWithStore(<PublishProgress taskId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('reload-icon-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('reload-icon-button'));

      await waitFor(() => {
        expect(mockElectronAPI.publish.retryTask).toHaveBeenCalledWith(1);
      });
    });

    test('应该能够刷新任务状态', async () => {
      renderWithStore(<PublishProgress taskId={1} />);

      const refreshButton = screen.getByTestId('reload-icon-button');
      fireEvent.click(refreshButton);

      await waitFor(() => {
        expect(mockElectronAPI.publish.getTaskById).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('结果展示测试', () => {
    test('应该显示发布成功结果', async () => {
      mockTask.status = 'completed';
      mockTask.results = [
        {
          platform: 'zhihu',
          status: 'success',
          url: 'https://zhihu.com/article/123',
          title: '测试文章',
          publishedAt: new Date().toISOString()
        }
      ];
      mockElectronAPI.publish.getTaskById.mockResolvedValue({
        success: true,
        data: mockTask
      });

      renderWithStore(<PublishProgress taskId={1} />);

      await waitFor(() => {
        expect(screen.getByText('发布成功')).toBeInTheDocument();
        expect(screen.getByText('知乎')).toBeInTheDocument();
        expect(screen.getByText('查看文章')).toBeInTheDocument();
      });
    });

    test('应该显示部分失败结果', async () => {
      mockTask.status = 'partial_failed';
      mockTask.results = [
        {
          platform: 'zhihu',
          status: 'success',
          url: 'https://zhihu.com/article/123'
        },
        {
          platform: 'xiaohongshu',
          status: 'failed',
          error: '内容格式不支持'
        }
      ];
      mockElectronAPI.publish.getTaskById.mockResolvedValue({
        success: true,
        data: mockTask
      });

      renderWithStore(<PublishProgress taskId={1} />);

      await waitFor(() => {
        expect(screen.getByText('部分发布成功')).toBeInTheDocument();
        expect(screen.getByText('内容格式不支持')).toBeInTheDocument();
      });
    });

    test('应该显示完全失败结果', async () => {
      mockTask.status = 'failed';
      mockTask.error = '所有平台发布失败';
      mockTask.results = [
        {
          platform: 'zhihu',
          status: 'failed',
          error: '登录状态过期'
        }
      ];
      mockElectronAPI.publish.getTaskById.mockResolvedValue({
        success: true,
        data: mockTask
      });

      renderWithStore(<PublishProgress taskId={1} />);

      await waitFor(() => {
        expect(screen.getByText('发布失败')).toBeInTheDocument();
        expect(screen.getByText('所有平台发布失败')).toBeInTheDocument();
      });
    });
  });

  describe('平台状态显示测试', () => {
    test('应该显示每个平台的发布状态', async () => {
      mockTask.results = [
        {
          platform: 'zhihu',
          status: 'success',
          url: 'https://zhihu.com/article/123',
          publishedAt: new Date().toISOString()
        },
        {
          platform: 'xiaohongshu',
          status: 'in_progress',
          progress: 60
        },
        {
          platform: 'weixin',
          status: 'pending'
        }
      ];
      mockElectronAPI.publish.getTaskById.mockResolvedValue({
        success: true,
        data: mockTask
      });

      renderWithStore(<PublishProgress taskId={1} />);

      await waitFor(() => {
        expect(screen.getByText('知乎')).toBeInTheDocument();
        expect(screen.getByText('小红书')).toBeInTheDocument();
        expect(screen.getByText('微信公众号')).toBeInTheDocument();
      });
    });

    test('应该显示平台图标和链接', async () => {
      mockTask.results = [
        {
          platform: 'zhihu',
          status: 'success',
          url: 'https://zhihu.com/article/123'
        }
      ];
      mockElectronAPI.publish.getTaskById.mockResolvedValue({
        success: true,
        data: mockTask
      });

      renderWithStore(<PublishProgress taskId={1} />);

      await waitFor(() => {
        expect(screen.getByTestId('eye-icon-button')).toBeInTheDocument();
      });
    });
  });

  describe('性能测试', () => {
    test('组件渲染应该在100ms内完成', () => {
      const startTime = performance.now();

      renderWithStore(<PublishProgress taskId={1} />);

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(100);
    });

    test('步骤切换应该流畅', async () => {
      const mockSteps = Array.from({ length: 5 }, (_, i) => ({
        id: i + 1,
        time: new Date().toISOString(),
        level: 'info',
        message: `步骤 ${i + 1} 完成`
      }));

      mockElectronAPI.publish.getTaskLogs.mockResolvedValue({
        success: true,
        data: mockSteps
      });

      renderWithStore(<PublishProgress taskId={1} showLogs={true} />);

      const startTime = performance.now();

      await waitFor(() => {
        expect(screen.getByTestId('timeline-item-4')).toBeInTheDocument();
      });

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(200);
    });
  });

  describe('响应式测试', () => {
    test('在小屏幕上应该调整布局', () => {
      global.innerWidth = 500;
      global.dispatchEvent(new Event('resize'));

      renderWithStore(<PublishProgress taskId={1} />);

      const card = screen.getByTestId('card');
      expect(card).toHaveClass('publish-progress-mobile');
    });

    test('紧凑模式应该适配移动设备', () => {
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        configurable: true
      });

      renderWithStore(
        <PublishProgress taskId={1} compact={true} />
      );

      const steps = screen.getByTestId('steps');
      expect(steps).toHaveAttribute('data-direction', 'vertical');
      expect(steps).toHaveAttribute('data-size', 'small');
    });
  });

  describe('可访问性测试', () => {
    test('进度条应该有正确的ARIA属性', async () => {
      mockTask.progress = 75;
      mockElectronAPI.publish.getTaskById.mockResolvedValue({
        success: true,
        data: mockTask
      });

      renderWithStore(<PublishProgress taskId={1} />);

      await waitFor(() => {
        const progressBar = screen.getByRole('progressbar');
        expect(progressBar).toHaveAttribute('aria-valuenow', '75');
        expect(progressBar).toHaveAttribute('aria-valuemin', '0');
        expect(progressBar).toHaveAttribute('aria-valuemax', '100');
      });
    });

    test('步骤应该有正确的ARIA标签', async () => {
      mockElectronAPI.publish.getTaskById.mockResolvedValue({
        success: true,
        data: mockTask
      });

      renderWithStore(<PublishProgress taskId={1} />);

      await waitFor(() => {
        expect(screen.getByRole('list')).toHaveAttribute('aria-label', '发布步骤');
      });
    });
  });
});