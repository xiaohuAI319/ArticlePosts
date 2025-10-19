/**
 * T018 PublishButton组件测试
 * 一键发布UI界面的测试驱动开发
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { message } from 'antd';
import PublishButton from '../../../../src/renderer/components/Publish/PublishButton.jsx';
import publishSlice from '../../../../src/renderer/store/slices/publishSlice.js';
import articlesSlice from '../../../../src/renderer/store/slices/articleSlice.js';

// 模拟依赖
jest.mock('antd', () => ({
  Button: ({ children, onClick, disabled, loading, type, icon, danger }) => (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      type={type}
      data-testid={icon ? `${icon}-button` : 'publish-button'}
      data-loading={loading}
      data-danger={danger}
    >
      {loading ? '发布中...' : children}
    </button>
  ),
  Modal: ({ visible, onOk, onCancel, title, children, footer, width }) =>
    visible ? (
      <div data-testid="publish-modal">
        <h2 data-testid="modal-title">{title}</h2>
        <div data-testid="modal-content">{children}</div>
        <div data-testid="modal-footer">{footer}</div>
        <button data-testid="modal-ok" onClick={onOk}>确认</button>
        <button data-testid="modal-cancel" onClick={onCancel}>取消</button>
      </div>
    ) : null,
  Progress: ({ percent, status, format, strokeWidth }) => (
    <div data-testid="progress-bar" data-percent={percent} data-status={status}>
      <div data-testid="progress-text">{format ? format(percent) : `${percent}%`}</div>
    </div>
  ),
  Card: ({ title, children, size, extra }) => (
    <div data-testid="card" data-size={size}>
      <div data-testid="card-title">{title}</div>
      <div data-testid="card-extra">{extra}</div>
      <div data-testid="card-content">{children}</div>
    </div>
  ),
  Space: ({ children, direction, size }) => (
    <div data-testid="space" data-direction={direction} data-size={size}>
      {children}
    </div>
  ),
  Typography: {
    Text: ({ children, type, ...props }) => (
      <span data-testid="text" data-type={type} {...props}>{children}</span>
    ),
    Title: ({ children, level, ...props }) => (
      <h1 data-testid="title" data-level={level} {...props}>{children}</h1>
    )
  },
  message: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
    loading: jest.fn()
  }
}));

// 模拟图标
jest.mock('@ant-design/icons', () => ({
  SendOutlined: () => <span data-testid="send-icon">Send</span>,
  CloseOutlined: () => <span data-testid="close-icon">Close</span>,
  CheckCircleOutlined: () => <span data-testid="check-icon">Check</span>,
  ExclamationCircleOutlined: () => <span data-testid="exclamation-icon">Exclamation</span>
}));

// 模拟electronAPI
const mockElectronAPI = {
  publish: {
    createTask: jest.fn(),
    getTaskById: jest.fn(),
    cancelTask: jest.fn(),
    retryTask: jest.fn()
  }
};

global.window = {
  electronAPI: mockElectronAPI
};

// 创建测试store
function createTestStore() {
  return configureStore({
    reducer: {
      publish: publishSlice,
      articles: articlesSlice
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

describe('T018 PublishButton组件', () => {
  let store;
  let mockOnPublishComplete;

  beforeEach(() => {
    jest.clearAllMocks();
    store = createTestStore();
    mockOnPublishComplete = jest.fn();

    // 设置测试文章数据
    store.dispatch(articlesSlice.addArticle({
      id: 1,
      title: '测试文章',
      content: '这是一篇测试文章的内容',
      status: 0
    }));
  });

  describe('组件渲染测试', () => {
    test('应该正确渲染发布按钮', () => {
      renderWithStore(
        <PublishButton
          articleId={1}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      const publishButton = screen.getByTestId('send-icon-button');
      expect(publishButton).toBeInTheDocument();
      expect(publishButton).toHaveTextContent('一键发布');
    });

    test('应该显示自定义标题', () => {
      renderWithStore(
        <PublishButton
          articleId={1}
          title="开始发布"
          onPublishComplete={mockOnPublishComplete}
        />
      );

      const publishButton = screen.getByTestId('send-icon-button');
      expect(publishButton).toHaveTextContent('开始发布');
    });

    test('文章不存在时应该禁用按钮', () => {
      renderWithStore(
        <PublishButton
          articleId={999}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      const publishButton = screen.getByTestId('send-icon-button');
      expect(publishButton).toBeDisabled();
    });
  });

  describe('发布流程测试', () => {
    test('应该显示发布配置模态框', async () => {
      mockElectronAPI.publish.getTaskById.mockResolvedValue({
        success: true,
        data: {
          id: 1,
          status: 'pending',
          config: {
            platforms: ['zhihu'],
            publishTime: 'immediate'
          }
        }
      });

      renderWithStore(
        <PublishButton
          articleId={1}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      const publishButton = screen.getByTestId('send-icon-button');
      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(screen.getByTestId('publish-modal')).toBeInTheDocument();
        expect(screen.getByTestId('modal-title')).toHaveTextContent('发布配置');
      });
    });

    test('应该显示平台选择选项', async () => {
      renderWithStore(
        <PublishButton
          articleId={1}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      const publishButton = screen.getByTestId('send-icon-button');
      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(screen.getByText('选择发布平台')).toBeInTheDocument();
        expect(screen.getByText('知乎')).toBeInTheDocument();
      });
    });

    test('应该显示发布时间选项', async () => {
      renderWithStore(
        <PublishButton
          articleId={1}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      const publishButton = screen.getByTestId('send-icon-button');
      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(screen.getByText('发布时间')).toBeInTheDocument();
        expect(screen.getByText('立即发布')).toBeInTheDocument();
        expect(screen.getByText('定时发布')).toBeInTheDocument();
      });
    });
  });

  describe('发布状态管理测试', () => {
    test('发布时应该显示加载状态', async () => {
      // 模拟创建发布任务
      mockElectronAPI.publish.createTask.mockResolvedValue({
        success: true,
        data: { id: 1, status: 'pending' }
      });

      renderWithStore(
        <PublishButton
          articleId={1}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      const publishButton = screen.getByTestId('send-icon-button');
      fireEvent.click(publishButton);

      // 确认发布
      await waitFor(() => {
        expect(screen.getByTestId('modal-ok')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('modal-ok'));

      // 检查按钮状态
      await waitFor(() => {
        const button = screen.getByTestId('send-icon-button');
        expect(button).toHaveAttribute('data-loading', 'true');
      });
    });

    test('发布完成后应该调用回调函数', async () => {
      const taskData = {
        id: 1,
        articleId: 1,
        status: 'completed',
        results: [
          { platform: 'zhihu', status: 'success', url: 'https://zhihu.com/article/123' }
        ]
      };

      mockElectronAPI.publish.createTask.mockResolvedValue({
        success: true,
        data: { id: 1, status: 'pending' }
      });

      renderWithStore(
        <PublishButton
          articleId={1}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      // 模拟发布完成
      const publishButton = screen.getByTestId('send-icon-button');
      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(screen.getByTestId('modal-ok')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('modal-ok'));

      // 模拟任务完成
      await waitFor(() => {
        store.dispatch(publishSlice.setCurrentTask(taskData));
      });

      await waitFor(() => {
        expect(mockOnPublishComplete).toHaveBeenCalledWith(taskData);
      });
    });
  });

  describe('错误处理测试', () => {
    test('创建发布任务失败时应该显示错误信息', async () => {
      mockElectronAPI.publish.createTask.mockResolvedValue({
        success: false,
        message: '创建发布任务失败'
      });

      renderWithStore(
        <PublishButton
          articleId={1}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      const publishButton = screen.getByTestId('send-icon-button');
      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(screen.getByTestId('modal-ok')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('modal-ok'));

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith('创建发布任务失败');
      });
    });

    test('网络错误时应该显示重试选项', async () => {
      mockElectronAPI.publish.createTask.mockRejectedValue(
        new Error('网络连接失败')
      );

      renderWithStore(
        <PublishButton
          articleId={1}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      const publishButton = screen.getByTestId('send-icon-button');
      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(screen.getByText('网络连接失败')).toBeInTheDocument();
        expect(screen.getByText('重试')).toBeInTheDocument();
      });
    });
  });

  describe('交互功能测试', () => {
    test('应该能够取消发布', async () => {
      renderWithStore(
        <PublishButton
          articleId={1}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      const publishButton = screen.getByTestId('send-icon-button');
      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(screen.getByTestId('modal-cancel')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('modal-cancel'));

      await waitFor(() => {
        expect(screen.queryByTestId('publish-modal')).not.toBeInTheDocument();
      });
    });

    test('应该能够选择多个平台', async () => {
      renderWithStore(
        <PublishButton
          articleId={1}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      const publishButton = screen.getByTestId('send-icon-button');
      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(screen.getByText('知乎')).toBeInTheDocument();
      });

      // 选择平台
      const zhihuCheckbox = screen.getByLabelText('知乎');
      fireEvent.click(zhihuCheckbox);

      // 验证选择状态
      expect(zhihuCheckbox).toBeChecked();
    });

    test('应该能够设置定时发布', async () => {
      renderWithStore(
        <PublishButton
          articleId={1}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      const publishButton = screen.getByTestId('send-icon-button');
      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(screen.getByText('定时发布')).toBeInTheDocument();
      });

      // 选择定时发布
      const scheduledRadio = screen.getByLabelText('定时发布');
      fireEvent.click(scheduledRadio);

      // 验证时间选择器出现
      expect(screen.getByTestId('datetime-picker')).toBeInTheDocument();
    });
  });

  describe('进度显示测试', () => {
    test('应该显示发布进度', async () => {
      const taskData = {
        id: 1,
        status: 'in_progress',
        progress: 45,
        currentStep: '内容填充',
        totalSteps: 5
      };

      mockElectronAPI.publish.createTask.mockResolvedValue({
        success: true,
        data: taskData
      });

      renderWithStore(
        <PublishButton
          articleId={1}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      // 开始发布
      const publishButton = screen.getByTestId('send-icon-button');
      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(screen.getByTestId('modal-ok')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('modal-ok'));

      // 设置任务状态
      store.dispatch(publishSlice.setCurrentTask(taskData));

      await waitFor(() => {
        expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
        expect(screen.getByTestId('progress-bar')).toHaveAttribute('data-percent', '45');
      });
    });

    test('应该显示当前步骤信息', async () => {
      const taskData = {
        id: 1,
        status: 'in_progress',
        currentStep: '登录验证',
        stepMessage: '正在检查知乎登录状态...'
      };

      store.dispatch(publishSlice.setCurrentTask(taskData));

      renderWithStore(
        <PublishButton
          articleId={1}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('正在检查知乎登录状态...')).toBeInTheDocument();
      });
    });
  });

  describe('结果展示测试', () => {
    test('应该显示发布成功结果', async () => {
      const taskData = {
        id: 1,
        status: 'completed',
        results: [
          {
            platform: 'zhihu',
            status: 'success',
            url: 'https://zhihu.com/article/123',
            title: '测试文章'
          }
        ]
      };

      store.dispatch(publishSlice.setCurrentTask(taskData));

      renderWithStore(
        <PublishButton
          articleId={1}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('发布成功！')).toBeInTheDocument();
        expect(screen.getByText('知乎')).toBeInTheDocument();
        expect(screen.getByText('查看文章')).toBeInTheDocument();
      });
    });

    test('应该显示部分失败结果', async () => {
      const taskData = {
        id: 1,
        status: 'partial_failed',
        results: [
          {
            platform: 'zhihu',
            status: 'success',
            url: 'https://zhihu.com/article/123'
          },
          {
            platform: 'xiaohongshu',
            status: 'failed',
            error: '登录状态过期'
          }
        ]
      };

      store.dispatch(publishSlice.setCurrentTask(taskData));

      renderWithStore(
        <PublishButton
          articleId={1}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      await waitFor(() => {
        expect(screen.getByText('部分发布成功')).toBeInTheDocument();
        expect(screen.getByText('小红书发布失败')).toBeInTheDocument();
        expect(screen.getByText('登录状态过期')).toBeInTheDocument();
      });
    });
  });

  describe('响应式测试', () => {
    test('在小屏幕上应该调整布局', () => {
      // 模拟小屏幕
      global.innerWidth = 500;
      global.dispatchEvent(new Event('resize'));

      renderWithStore(
        <PublishButton
          articleId={1}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      const modal = screen.getByTestId('publish-modal');
      expect(modal).toHaveClass('publish-modal-mobile');
    });

    test('在移动设备上应该调整按钮大小', () => {
      // 模拟移动设备
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)',
        configurable: true
      });

      renderWithStore(
        <PublishButton
          articleId={1}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      const button = screen.getByTestId('send-icon-button');
      expect(button).toHaveClass('publish-button-mobile');
    });
  });

  describe('性能测试', () => {
    test('组件渲染应该在100ms内完成', () => {
      const startTime = performance.now();

      renderWithStore(
        <PublishButton
          articleId={1}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(100);
    });

    test('模态框打开动画应该流畅', async () => {
      renderWithStore(
        <PublishButton
          articleId={1}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      const publishButton = screen.getByTestId('send-icon-button');

      const startTime = performance.now();
      fireEvent.click(publishButton);

      await waitFor(() => {
        expect(screen.getByTestId('publish-modal')).toBeInTheDocument();
      });

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(200);
    });
  });

  describe('可访问性测试', () => {
    test('按钮应该有正确的ARIA标签', () => {
      renderWithStore(
        <PublishButton
          articleId={1}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-label', '一键发布文章');
    });

    test('模态框应该有正确的ARIA属性', async () => {
      renderWithStore(
        <PublishButton
          articleId={1}
          onPublishComplete={mockOnPublishComplete}
        />
      );

      const publishButton = screen.getByTestId('send-icon-button');
      fireEvent.click(publishButton);

      await waitFor(() => {
        const modal = screen.getByRole('dialog');
        expect(modal).toHaveAttribute('aria-modal', 'true');
        expect(modal).toHaveAttribute('aria-labelledby', 'modal-title');
      });
    });
  });
});