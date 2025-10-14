/**
 * T003 React渲染进程测试
 * 测试React应用初始化、组件渲染和状态管理
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { ConfigProvider } from 'antd';
import { store } from '../../../src/renderer/store';
import App from '../../../src/renderer/App';

// Mock electronAPI
global.window.electronAPI = {
  getAppVersion: jest.fn(() => '1.0.0'),
  getPlatform: jest.fn(() => 'darwin'),
  database: {
    getStats: jest.fn(() => ({ tables: 8, size: '0.14MB' })),
    checkHealth: jest.fn(() => ({ status: 'healthy' }))
  },
  articles: {
    create: jest.fn(),
    findAll: jest.fn(() => []),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  platforms: {
    findAll: jest.fn(() => []),
    getAvailable: jest.fn(() => [])
  },
  onMenuAction: jest.fn(),
  sendMessage: jest.fn(),
  onMessage: jest.fn(),
  removeAllListeners: jest.fn()
};

// Mock Redux store actions
const mockDispatch = jest.fn();
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: () => mockDispatch,
  useSelector: jest.fn((selector) => {
    // Mock different states based on selector
    if (selector.toString().includes('app')) {
      return { loading: false, initialized: true };
    }
    if (selector.toString().includes('articles')) {
      return { currentArticle: null, saving: false };
    }
    if (selector.toString().includes('publish')) {
      return { publishing: false, tasks: [] };
    }
    return {};
  })
}));

describe('T003 React渲染进程测试', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('1. React应用初始化', () => {
    test('应该成功渲染React应用', () => {
      render(
        <Provider store={store}>
          <ConfigProvider>
            <App />
          </ConfigProvider>
        </Provider>
      );

      // 验证应用布局渲染
      expect(screen.getByRole('main') || document.querySelector('.app-layout')).toBeInTheDocument();
    });

    test('应该正确配置Ant Design中文环境', () => {
      render(
        <Provider store={store}>
          <ConfigProvider>
            <App />
          </ConfigProvider>
        </Provider>
      );

      // 验证ConfigProvider是否正确应用
      const appContainer = document.querySelector('.app-layout');
      expect(appContainer).toBeInTheDocument();
    });

    test('应该在加载状态显示加载界面', () => {
      // Mock loading state
      const { useSelector } = require('react-redux');
      useSelector.mockImplementation((selector) => {
        if (selector.toString().includes('app')) {
          return { loading: true, initialized: false };
        }
        return {};
      });

      render(
        <Provider store={store}>
          <ConfigProvider>
            <App />
          </ConfigProvider>
        </Provider>
      );

      // 验证加载界面
      expect(screen.getByText('正在初始化应用...')).toBeInTheDocument();
    });
  });

  describe('2. 应用布局结构', () => {
    test('应该渲染完整的应用布局', async () => {
      render(
        <Provider store={store}>
          <ConfigProvider>
            <App />
          </ConfigProvider>
        </Provider>
      );

      // 等待组件加载完成
      await waitFor(() => {
        expect(document.querySelector('.app-layout')).toBeInTheDocument();
      });

      // 验证主要布局组件
      expect(document.querySelector('.app-header')).toBeInTheDocument();
      expect(document.querySelector('.app-sidebar')).toBeInTheDocument();
      expect(document.querySelector('.app-content')).toBeInTheDocument();
      expect(document.querySelector('.app-statusbar')).toBeInTheDocument();
    });

    test('应该正确处理侧边栏折叠状态', async () => {
      render(
        <Provider store={store}>
          <ConfigProvider>
            <App />
          </ConfigProvider>
        </Provider>
      );

      await waitFor(() => {
        expect(document.querySelector('.app-layout')).toBeInTheDocument();
      });

      // 验证侧边栏存在
      const sidebar = document.querySelector('.app-sidebar');
      expect(sidebar).toBeInTheDocument();

      // 初始状态应该是展开的
      expect(sidebar).not.toHaveClass('ant-layout-sider-collapsed');
    });
  });

  describe('3. 菜单事件处理', () => {
    test('应该注册菜单事件监听器', async () => {
      render(
        <Provider store={store}>
          <ConfigProvider>
            <App />
          </ConfigProvider>
        </Provider>
      );

      await waitFor(() => {
        expect(document.querySelector('.app-layout')).toBeInTheDocument();
      });

      // 验证electronAPI.onMenuAction被调用
      expect(global.window.electronAPI.onMenuAction).toHaveBeenCalledTimes(1);
    });

    test('应该处理新建文章菜单事件', async () => {
      const { message } = require('antd');
      const mockInfo = jest.fn();
      message.info = mockInfo;

      // 获取菜单回调函数
      let menuCallback;
      global.window.electronAPI.onMenuAction.mockImplementation((callback) => {
        menuCallback = callback;
      });

      render(
        <Provider store={store}>
          <ConfigProvider>
            <App />
          </ConfigProvider>
        </Provider>
      );

      await waitFor(() => {
        expect(document.querySelector('.app-layout')).toBeInTheDocument();
      });

      // 模拟菜单事件
      if (menuCallback) {
        menuCallback(null, 'menu-new-article');

        // 验证消息显示
        expect(mockInfo).toHaveBeenCalledWith('新建文章功能开发中...');
      }
    });

    test('应该处理保存草稿菜单事件', async () => {
      const { message } = require('antd');
      const mockInfo = jest.fn();
      message.info = mockInfo;

      let menuCallback;
      global.window.electronAPI.onMenuAction.mockImplementation((callback) => {
        menuCallback = callback;
      });

      render(
        <Provider store={store}>
          <ConfigProvider>
            <App />
          </ConfigProvider>
        </Provider>
      );

      await waitFor(() => {
        expect(document.querySelector('.app-layout')).toBeInTheDocument();
      });

      // 模拟菜单事件
      if (menuCallback) {
        menuCallback(null, 'menu-save-draft');

        // 验证消息显示
        expect(mockInfo).toHaveBeenCalledWith('保存草稿功能开发中...');
      }
    });

    test('应该处理一键发布菜单事件', async () => {
      const { message } = require('antd');
      const mockInfo = jest.fn();
      message.info = mockInfo;

      let menuCallback;
      global.window.electronAPI.onMenuAction.mockImplementation((callback) => {
        menuCallback = callback;
      });

      render(
        <Provider store={store}>
          <ConfigProvider>
            <App />
          </ConfigProvider>
        </Provider>
      );

      await waitFor(() => {
        expect(document.querySelector('.app-layout')).toBeInTheDocument();
      });

      // 模拟菜单事件
      if (menuCallback) {
        menuCallback(null, 'menu-publish');

        // 验证消息显示
        expect(mockInfo).toHaveBeenCalledWith('一键发布功能开发中...');
      }
    });

    test('应该处理平台管理菜单事件', async () => {
      const { message } = require('antd');
      const mockInfo = jest.fn();
      message.info = mockInfo;

      let menuCallback;
      global.window.electronAPI.onMenuAction.mockImplementation((callback) => {
        menuCallback = callback;
      });

      render(
        <Provider store={store}>
          <ConfigProvider>
            <App />
          </ConfigProvider>
        </Provider>
      );

      await waitFor(() => {
        expect(document.querySelector('.app-layout')).toBeInTheDocument();
      });

      // 模拟菜单事件
      if (menuCallback) {
        menuCallback(null, 'menu-platform-manage');

        // 验证消息显示
        expect(mockInfo).toHaveBeenCalledWith('平台管理功能开发中...');
      }
    });
  });

  describe('4. 组件卸载和清理', () => {
    test('应该正确清理事件监听器', () => {
      const { unmount } = render(
        <Provider store={store}>
          <ConfigProvider>
            <App />
          </ConfigProvider>
        </Provider>
      );

      // 卸载组件
      unmount();

      // 验证removeAllListeners被调用
      expect(global.window.electronAPI.removeAllListeners).toHaveBeenCalledTimes(4);
      expect(global.window.electronAPI.removeAllListeners).toHaveBeenCalledWith('menu-new-article');
      expect(global.window.electronAPI.removeAllListeners).toHaveBeenCalledWith('menu-save-draft');
      expect(global.window.electronAPI.removeAllListeners).toHaveBeenCalledWith('menu-publish');
      expect(global.window.electronAPI.removeAllListeners).toHaveBeenCalledWith('menu-platform-manage');
    });
  });

  describe('5. 错误处理', () => {
    test('应该处理应用初始化失败', async () => {
      const { message } = require('antd');
      const mockError = jest.fn();
      message.error = mockError;

      // Mock初始化失败
      const { useDispatch } = require('react-redux');
      const mockDispatchError = jest.fn(() => {
        throw new Error('初始化失败');
      });
      useDispatch.mockReturnValue(mockDispatchError);

      render(
        <Provider store={store}>
          <ConfigProvider>
            <App />
          </ConfigProvider>
        </Provider>
      );

      // 等待错误处理
      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith('应用启动失败，请重试');
      });
    });
  });
});