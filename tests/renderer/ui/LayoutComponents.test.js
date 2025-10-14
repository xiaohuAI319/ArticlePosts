/**
 * T004 基础UI布局框架测试
 * 测试布局组件、主题系统和响应式设计
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { ConfigProvider } from 'antd';
import { store } from '../../../src/renderer/store';
import { theme } from '../../../src/renderer/styles/theme';

// Mock electronAPI
global.window.electronAPI = {
  getAppVersion: jest.fn(() => '1.0.0'),
  getPlatform: jest.fn(() => 'darwin'),
  database: { getStats: jest.fn(), checkHealth: jest.fn() },
  articles: { create: jest.fn(), findAll: jest.fn(), findById: jest.fn(), update: jest.fn(), delete: jest.fn() },
  platforms: { findAll: jest.fn(), getAvailable: jest.fn() },
  onMenuAction: jest.fn(),
  sendMessage: jest.fn(),
  onMessage: jest.fn(),
  removeAllListeners: jest.fn()
};

// Mock Redux hooks
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: jest.fn((selector) => {
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

describe('T004 基础UI布局框架测试', () => {
  const renderWithProviders = (component) => {
    return render(
      <Provider store={store}>
        <ConfigProvider theme={theme}>
          {component}
        </ConfigProvider>
      </Provider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. 主题系统测试', () => {
    test('应该导出完整的主题配置', () => {
      const { colors, typography, spacing, breakpoints, antdTheme } = require('../../../src/renderer/styles/theme');

      // 验证颜色系统
      expect(colors).toBeDefined();
      expect(colors.primary).toBeDefined();
      expect(colors.primary[500]).toBe('#0ea5e9');
      expect(colors.success[500]).toBe('#22c55e');
      expect(colors.error[500]).toBe('#ef4444');

      // 验证字体系统
      expect(typography).toBeDefined();
      expect(typography.fontFamily).toBeDefined();
      expect(typography.fontSize).toBeDefined();
      expect(typography.fontSize.base).toBe('16px');

      // 验证间距系统
      expect(spacing).toBeDefined();
      expect(spacing[4]).toBe('16px');
      expect(spacing[8]).toBe('32px');

      // 验证断点系统
      expect(breakpoints).toBeDefined();
      expect(breakpoints.md).toBe('768px');
      expect(breakpoints.lg).toBe('992px');

      // 验证Ant Design主题配置
      expect(antdTheme).toBeDefined();
      expect(antdTheme.token.colorPrimary).toBe(colors.primary[500]);
    });

    test('应该正确生成CSS变量', () => {
      const { generateCSSVariables } = require('../../../src/renderer/styles/theme');
      const cssVars = generateCSSVariables();

      expect(cssVars).toBeDefined();
      expect(cssVars['--color-primary-500']).toBe('#0ea5e9');
      expect(cssVars['--font-size-base']).toBe('16px');
      expect(cssVars['--spacing-4']).toBe('16px');
    });

    test('应该支持主题切换', () => {
      const { createTheme, getThemeColor } = require('../../../src/renderer/styles/theme');

      const lightTheme = createTheme(false);
      const darkTheme = createTheme(true);

      expect(lightTheme.algorithm).not.toBe('darkAlgorithm');
      expect(darkTheme.algorithm).toBe('darkAlgorithm');

      const lightPrimary = getThemeColor('token.colorPrimary', false);
      const darkPrimary = getThemeColor('token.colorPrimary', true);

      expect(lightPrimary).toBe('#0ea5e9');
      expect(darkPrimary).toBe('#38bdf8');
    });
  });

  describe('2. 布局组件结构测试', () => {
    test('应该渲染Header组件', async () => {
      const Header = require('../../../src/renderer/components/Layout/Header.jsx').default;

      renderWithProviders(<Header />);

      // 验证Header组件存在
      const header = document.querySelector('.app-header');
      expect(header).toBeInTheDocument();

      // 验证标题存在
      expect(screen.getByText('文章一键多发平台')).toBeInTheDocument();
    });

    test('应该渲染Sidebar组件', async () => {
      const Sidebar = require('../../../src/renderer/components/Layout/Sidebar.jsx').default;

      renderWithProviders(<Sidebar />);

      // 验证Sidebar组件存在
      const sidebar = document.querySelector('.app-sidebar');
      expect(sidebar).toBeInTheDocument();

      // 验证菜单项存在
      expect(screen.getByText('文章管理')).toBeInTheDocument();
      expect(screen.getByText('发布管理')).toBeInTheDocument();
      expect(screen.getByText('平台设置')).toBeInTheDocument();
    });

    test('应该渲染ContentArea组件', async () => {
      const ContentArea = require('../../../src/renderer/components/Layout/ContentArea.jsx').default;

      renderWithProviders(<ContentArea />);

      // 验证ContentArea组件存在
      const content = document.querySelector('.app-content');
      expect(content).toBeInTheDocument();
    });

    test('应该渲染StatusBar组件', async () => {
      const StatusBar = require('../../../src/renderer/components/Layout/StatusBar.jsx').default;

      renderWithProviders(<StatusBar />);

      // 验证StatusBar组件存在
      const statusBar = document.querySelector('.app-statusbar');
      expect(statusBar).toBeInTheDocument();
    });
  });

  describe('3. 响应式设计测试', () => {
    test('应该在移动端正确调整布局', async () => {
      // 模拟移动端视口
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 480,
      });

      const App = require('../../../src/renderer/App.jsx').default;
      renderWithProviders(<App />);

      await waitFor(() => {
        const layout = document.querySelector('.app-layout');
        expect(layout).toBeInTheDocument();

        // 验证移动端样式类
        expect(layout).toHaveClass('mobile-layout');
      });
    });

    test('应该在桌面端正确显示布局', async () => {
      // 模拟桌面端视口
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1200,
      });

      const App = require('../../../src/renderer/App.jsx').default;
      renderWithProviders(<App />);

      await waitFor(() => {
        const layout = document.querySelector('.app-layout');
        expect(layout).toBeInTheDocument();

        // 验证桌面端样式类
        expect(layout).not.toHaveClass('mobile-layout');
      });
    });

    test('应该正确处理侧边栏折叠', async () => {
      const Sidebar = require('../../../src/renderer/components/Layout/Sidebar.jsx').default;

      renderWithProviders(<Sidebar />);

      const collapseButton = screen.getByRole('button', { name: /折叠/i });

      // 初始状态应该是展开的
      const sidebar = document.querySelector('.app-sidebar');
      expect(sidebar).not.toHaveClass('ant-layout-sider-collapsed');

      // 点击折叠按钮
      fireEvent.click(collapseButton);

      // 应该变成折叠状态
      expect(sidebar).toHaveClass('ant-layout-sider-collapsed');
    });
  });

  describe('4. 导航和路由测试', () => {
    test('应该正确处理菜单导航', async () => {
      const Sidebar = require('../../../src/renderer/components/Layout/Sidebar.jsx').default;

      renderWithProviders(<Sidebar />);

      // 点击文章管理菜单
      const articleMenu = screen.getByText('文章管理');
      fireEvent.click(articleMenu);

      // 验证当前页面指示
      await waitFor(() => {
        const activeItem = document.querySelector('.ant-menu-item-selected');
        expect(activeItem).toBeInTheDocument();
        expect(activeItem).toHaveTextContent('文章管理');
      });
    });

    test('应该正确显示页面标题', async () => {
      const Header = require('../../../src/renderer/components/Layout/Header.jsx').default;

      renderWithProviders(<Header />);

      // 验证页面标题显示
      const title = screen.getByText('文章一键多发平台');
      expect(title).toBeInTheDocument();
    });
  });

  describe('5. 样式和主题应用测试', () => {
    test('应该正确应用主题色到组件', async () => {
      const App = require('../../../src/renderer/App.jsx').default;

      renderWithProviders(<App />);

      await waitFor(() => {
        const header = document.querySelector('.app-header');
        expect(header).toBeInTheDocument();

        // 验证主题色应用
        const computedStyle = window.getComputedStyle(header);
        expect(computedStyle.backgroundColor).toContain('rgb(14, 165, 233)'); // primary[600]
      });
    });

    test('应该正确应用字体系统', async () => {
      const App = require('../../../src/renderer/App.jsx').default;

      renderWithProviders(<App />);

      await waitFor(() => {
        const appElement = document.querySelector('.app-layout');
        expect(appElement).toBeInTheDocument();

        // 验证字体应用
        const computedStyle = window.getComputedStyle(appElement);
        expect(computedStyle.fontFamily).toContain('PingFang SC');
      });
    });

    test('应该正确应用间距系统', async () => {
      const App = require('../../../src/renderer/App.jsx').default;

      renderWithProviders(<App />);

      await waitFor(() => {
        const content = document.querySelector('.app-content');
        expect(content).toBeInTheDocument();

        // 验证间距应用
        const computedStyle = window.getComputedStyle(content);
        expect(parseInt(computedStyle.padding)).toBeGreaterThan(0);
      });
    });
  });

  describe('6. 状态管理集成测试', () => {
    test('应该正确连接Redux状态', async () => {
      const App = require('../../../src/renderer/App.jsx').default;

      renderWithProviders(<App />);

      await waitFor(() => {
        // 验证应用初始化状态
        expect(screen.queryByText('正在初始化应用...')).not.toBeInTheDocument();
      });
    });

    test('应该正确处理加载状态', async () => {
      // Mock加载状态
      const { useSelector } = require('react-redux');
      useSelector.mockImplementation((selector) => {
        if (selector.toString().includes('app')) {
          return { loading: true, initialized: false };
        }
        return {};
      });

      const App = require('../../../src/renderer/App.jsx').default;
      renderWithProviders(<App />);

      // 验证加载界面显示
      expect(screen.getByText('正在初始化应用...')).toBeInTheDocument();
    });
  });

  describe('7. 错误处理测试', () => {
    test('应该正确处理组件加载错误', async () => {
      // Mock错误状态
      const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

      const App = require('../../../src/renderer/App.jsx').default;
      renderWithProviders(<App />);

      // 模拟组件错误
      const error = new Error('组件加载失败');
      const errorBoundary = document.querySelector('.error-boundary');

      if (errorBoundary) {
        fireEvent.error(errorBoundary, { error });
      }

      consoleError.mockRestore();
    });

    test('应该正确处理网络错误', async () => {
      const { message } = require('antd');
      const mockError = jest.fn();
      message.error = mockError;

      // Mock网络错误
      global.window.electronAPI.database.getStats.mockRejectedValue(new Error('网络连接失败'));

      const App = require('../../../src/renderer/App.jsx').default;
      renderWithProviders(<App />);

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith('网络连接失败');
      });
    });
  });

  describe('8. 性能优化测试', () => {
    test('应该正确使用React.memo优化组件', async () => {
      const Header = require('../../../src/renderer/components/Layout/Header.jsx').default;

      // 验证组件是否被memo包装
      expect(Header.$$typeof).toBeDefined();
    });

    test('应该正确使用useCallback优化事件处理', async () => {
      const Sidebar = require('../../../src/renderer/components/Layout/Sidebar.jsx').default;

      renderWithProviders(<Sidebar />);

      // 验证点击事件处理
      const menuItem = screen.getByText('文章管理');

      // 多次点击应该不会重复创建函数
      const initialCalls = menuItem.onclick.toString();
      fireEvent.click(menuItem);
      fireEvent.click(menuItem);

      expect(menuItem.onclick.toString()).toBe(initialCalls);
    });
  });
});