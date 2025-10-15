/**
 * T011 平台管理页面组件测试
 * 遵循TDD原则，先写测试，后实现
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import PlatformsPage from '../../../../src/renderer/components/Pages/PlatformsPage';

// 创建模拟的store
const createMockStore = (initialState = {}) => {
  return configureStore({
    reducer: {
      articles: (state = { currentArticle: null, articles: [], editorState: { lastSaved: null } }) => state,
      platforms: (state = { platforms: [], loading: false }) => state
    },
    preloadedState: initialState
  });
};

describe('T011 平台管理页面', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('页面基础功能', () => {
    test('应该正确渲染平台管理页面标题', () => {
      const mockStore = createMockStore();

      render(
        <Provider store={mockStore}>
          <PlatformsPage />
        </Provider>
      );

      expect(screen.getByText('平台管理')).toBeInTheDocument();
      expect(screen.getByText('配置发布平台，管理登录状态和发布设置')).toBeInTheDocument();
    });

    test('应该显示平台列表容器', () => {
      render(<PlatformsPage />);

      expect(screen.getByRole('list')).toBeInTheDocument();
    });

    test('应该显示添加平台按钮', () => {
      render(<PlatformsPage />);

      const addButton = screen.getByRole('button', { name: /添加平台/i });
      expect(addButton).toBeInTheDocument();
    });
  });

  describe('平台列表功能 (AC1)', () => {
    test('应该显示加载中的状态', async () => {
      electronAPI.platforms.findAll.mockResolvedValue({
        success: true,
        data: []
      });

      render(<PlatformsPage />);

      expect(screen.getByText('正在加载平台列表...')).toBeInTheDocument();
    });

    test('应该显示空状态当没有平台时', async () => {
      electronAPI.platforms.findAll.mockResolvedValue({
        success: true,
        data: []
      });

      render(<PlatformsPage />);

      await waitFor(() => {
        expect(screen.getByText(/暂无平台配置/)).toBeInTheDocument();
      });
    });

    test('应该显示平台列表', async () => {
      const mockPlatforms = [
        {
          id: 1,
          name: 'zhihu',
          display_name: '知乎',
          icon_url: '',
          base_url: 'https://www.zhihu.com',
          login_url: 'https://www.zhihu.com/signin',
          publish_url: 'https://zhuanlan.zhihu.com/write',
          is_active: 1,
          status: 'offline'
        },
        {
          id: 2,
          name: 'xiaohongshu',
          display_name: '小红书',
          icon_url: '',
          base_url: 'https://www.xiaohongshu.com',
          login_url: 'https://creator.xiaohongshu.com',
          publish_url: '',
          is_active: 0,
          status: 'offline'
        }
      ];

      electronAPI.platforms.findAll.mockResolvedValue({
        success: true,
        data: mockPlatforms
      });

      render(<PlatformsPage />);

      await waitFor(() => {
        expect(screen.getByText('知乎')).toBeInTheDocument();
        expect(screen.getByText('小红书')).toBeInTheDocument();
      });
    });
  });

  describe('平台状态显示 (AC4)', () => {
    test('应该显示平台在线状态', async () => {
      const mockPlatforms = [
        {
          id: 1,
          name: 'zhihu',
          display_name: '知乎',
          icon_url: '',
          base_url: 'https://www.zhihu.com',
          is_active: 1,
          status: 'online'
        }
      ];

      electronAPI.platforms.findAll.mockResolvedValue({
        success: true,
        data: mockPlatforms
      });

      electronAPI.platforms.checkAllStatus.mockResolvedValue({
        success: true,
        data: [
          {
            platform: mockPlatforms[0],
            success: true,
            data: {
              status: 'online',
              response_time: 200,
              message: '平台可访问'
            }
          }
        ]
      });

      render(<PlatformsPage />);

      await waitFor(() => {
        expect(screen.getByText('在线')).toBeInTheDocument();
        expect(screen.getByText('200ms')).toBeInTheDocument();
      });
    });

    test('应该显示平台离线状态', async () => {
      const mockPlatforms = [
        {
          id: 1,
          name: 'zhihu',
          display_name: '知乎',
          icon_url: '',
          base_url: 'https://www.zhihu.com',
          is_active: 1,
          status: 'offline'
        }
      ];

      electronAPI.platforms.findAll.mockResolvedValue({
        success: true,
        data: mockPlatforms
      });

      electronAPI.platforms.checkAllStatus.mockResolvedValue({
        success: true,
        data: [
          {
            platform: mockPlatforms[0],
            success: false,
            data: {
              status: 'offline',
              response_time: 0,
              message: '平台不可访问'
            }
          }
        ]
      });

      render(<PlatformsPage />);

      await waitFor(() => {
        expect(screen.getByText('离线')).toBeInTheDocument();
        expect(screen.getByText('平台不可访问')).toBeInTheDocument();
      });
    });
  });

  describe('添加平台功能', () => {
    test('应该打开添加平台对话框', async () => {
      render(<PlatformsPage />);

      const addButton = screen.getByRole('button', { name: /添加平台/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText('添加发布平台')).toBeInTheDocument();
      });
    });

    test('应该成功创建新平台', async () => {
      electronAPI.platforms.create.mockResolvedValue({
        success: true,
        data: {
          id: 3,
          name: 'test-platform',
          display_name: '测试平台'
        }
      });

      render(<PlatformsPage />);

      const addButton = screen.getByRole('button', { name: /添加平台/i });
      fireEvent.click(addButton);

      // 模拟填写表单
      const nameInput = screen.getByLabelText(/平台名称/i);
      const slugInput = screen.getByLabelText(/平台标识/i);
      const urlInput = screen.getByLabelText(/基础URL/i);

      fireEvent.change(nameInput, { target: { value: '测试平台' } });
      fireEvent.change(slugInput, { target: { value: 'test-platform' } });
      fireEvent.change(urlInput, { target: { value: 'https://test.example.com' } });

      const submitButton = screen.getByRole('button', { name: /确定/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(electronAPI.platforms.create).toHaveBeenCalledWith({
          name: 'test-platform',
          slug: 'test-platform',
          base_url: 'https://test.example.com'
        });
        expect(message.success).toHaveBeenCalledWith('平台创建成功');
      });
    });

    test('应该处理创建失败', async () => {
      electronAPI.platforms.create.mockResolvedValue({
        success: false,
        error: 'Platform already exists',
        message: '平台已存在'
      });

      render(<PlatformsPage />);

      const addButton = screen.getByRole('button', { name: /添加平台/i });
      fireEvent.click(addButton);

      // 模拟填写表单
      const nameInput = screen.getByLabelText(/平台名称/i);
      fireEvent.change(nameInput, { target: { value: '重复平台' } });

      const submitButton = screen.getByRole('button', { name: /确定/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith('平台已存在');
      });
    });
  });

  describe('平台编辑功能', () => {
    test('应该打开编辑对话框', async () => {
      const mockPlatforms = [
        {
          id: 1,
          name: 'zhihu',
          display_name: '知乎',
          is_active: 1
        }
      ];

      electronAPI.platforms.findAll.mockResolvedValue({
        success: true,
        data: mockPlatforms
      });

      render(<PlatformsPage />);

      await waitFor(() => {
        const editButton = screen.getByRole('button', { name: /编辑知乎/i });
        fireEvent.click(editButton);
      });

      await waitFor(() => {
        expect(screen.getByText('编辑平台配置')).toBeInTheDocument();
      });
    });

    test('应该成功更新平台信息', async () => {
      const mockPlatforms = [
        {
          id: 1,
          name: 'zhihu',
          display_name: '知乎',
          description: '旧描述'
        }
      ];

      electronAPI.platforms.findAll.mockResolvedValue({
        success: true,
        data: mockPlatforms
      });

      electronAPI.platforms.update.mockResolvedValue({
        success: true,
        data: {
          ...mockPlatforms[0],
          description: '新描述'
        }
      });

      render(<PlatformsPage />);

      await waitFor(() => {
        const editButton = screen.getByRole('button', { name: /编辑知乎/i });
        fireEvent.click(editButton);
      });

      // 模拟更新表单
      const descInput = screen.getByLabelText(/平台描述/i);
      fireEvent.change(descInput, { target: { value: '新描述' } });

      const submitButton = screen.getByRole('button', { name: /保存/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(electronAPI.platforms.update).toHaveBeenCalledWith(1, {
          description: '新描述'
        });
        expect(message.success).toHaveBeenCalledWith('平台配置更新成功');
      });
    });
  });

  describe('平台删除功能', () => {
    test('应该确认删除操作', async () => {
      const mockPlatforms = [
        {
          id: 1,
          name: 'zhihu',
          display_name: '知乎',
          is_active: 1
        }
      ];

      electronAPI.platforms.findAll.mockResolvedValue({
        success: true,
        data: mockPlatforms
      });

      render(<PlatformsPage />);

      await waitFor(() => {
        const deleteButton = screen.getByRole('button', { name: /删除知乎/i });
        fireEvent.click(deleteButton);
      });

      await waitFor(() => {
        expect(screen.getByText(/确认删除知乎平台/)).toBeInTheDocument();
      });
    });

    test('应该成功删除平台', async () => {
      const mockPlatforms = [
        {
          id: 1,
          name: 'zhihu',
          display_name: '知乎',
          is_active: 1
        }
      ];

      electronAPI.platforms.findAll.mockResolvedValue({
        success: true,
        data: mockPlatforms
      });

      electronAPI.platforms.delete.mockResolvedValue({
        success: true
      });

      render(<PlatformsPage />);

      await waitFor(() => {
        const deleteButton = screen.getByRole('button', { name: /删除知乎/i });
        fireEvent.click(deleteButton);
      });

      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /确认删除/i });
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(electronAPI.platforms.delete).toHaveBeenCalledWith(1);
        expect(message.success).toHaveBeenCalledWith('平台删除成功');
      });
    });

    test('应该处理删除失败', async () => {
      const mockPlatforms = [
        {
          id: 1,
          name: 'zhihu',
          display_name: '知乎',
          is_active: 1
        }
      ];

      electronAPI.platforms.findAll.mockResolvedValue({
        success: true,
        data: mockPlatforms
      });

      electronAPI.platforms.delete.mockResolvedValue({
        success: false,
        error: 'Cannot delete platform with active sessions',
        message: '无法删除平台：存在相关的登录会话'
      });

      render(<PlatformsPage />);

      await waitFor(() => {
        const deleteButton = screen.getByRole('button', { name: /删除知乎/i });
        fireEvent.click(deleteButton);
      });

      await waitFor(() => {
        const confirmButton = screen.getByRole('button', { name: /确认删除/i });
        fireEvent.click(confirmButton);
      });

      await waitFor(() => {
        expect(message.error).toHaveBeenCalledWith('无法删除平台：存在相关的登录会话');
      });
    });
  });

  describe('批量状态检查功能', () => {
    test('应该显示批量检查进度', async () => {
      const mockPlatforms = [
        { id: 1, name: 'zhihu' },
        { id: 2, name: 'xiaohongshu' }
      ];

      electronAPI.platforms.findAll.mockResolvedValue({
        success: true,
        data: mockPlatforms
      });

      render(<PlatformsPage />);

      const checkAllButton = screen.getByRole('button', { name: /检查所有平台状态/i });
      fireEvent.click(checkAllButton);

      expect(screen.getByText('正在检查平台状态...')).toBeInTheDocument();
    });

    test('应该显示批量检查结果', async () => {
      const mockPlatforms = [
        { id: 1, name: 'zhihu' },
        { id: 2, name: 'xiaohongshu' }
      ];

      electronAPI.platforms.findAll.mockResolvedValue({
        success: true,
        data: mockPlatforms
      });

      electronAPI.platforms.checkAllStatus.mockResolvedValue({
        success: true,
        data: [
          {
          platform: mockPlatforms[0],
          success: true,
          data: { status: 'online', response_time: 200 }
          },
          {
            platform: mockPlatforms[1],
            success: true,
            data: { status: 'offline', response_time: 0 }
          }
        ]
      });

      render(<PlatformsPage />);

      const checkAllButton = screen.getByRole('button', { name: /检查所有平台状态/i });
      fireEvent.click(checkAllButton);

      await waitFor(() => {
        expect(screen.getByText('状态检查完成')).toBeInTheDocument();
        expect(screen.getByText('在线平台: 1')).toBeInTheDocument();
        expect(screen.getByText('离线平台: 1')).toBeInTheDocument();
      });
    });
  });

  describe('认证配置功能 (AC3)', () => {
    test('应该显示登录配置', async () => {
      const mockPlatforms = [
        {
          id: 1,
          name: 'zhihu',
          display_name: '知乎',
          config_schema: {
            auth_method: 'qr_code',
            auth_config: {
              qr_selector: '.qrcode',
              refresh_interval: 3000
            }
          }
        }
      ];

      electronAPI.platforms.findAll.mockResolvedValue({
        success: true,
        data: mockPlatforms
      });

      electronAPI.platforms.getLoginConfig.mockResolvedValue({
        success: true,
        data: {
          platform: mockPlatforms[0],
          loginConfig: {
            method: 'qr_code',
            baseUrl: 'https://www.zhihu.com',
            loginUrl: 'https://www.zhihu.com/signin',
            qrCodeConfig: {
              selector: '.qrcode',
              refreshInterval: 3000,
              maxAttempts: 60
            }
          }
        }
      });

      render(<PlatformsPage />);

      await waitFor(() => {
        const authButton = screen.getByRole('button', { name: /查看认证配置/i });
        fireEvent.click(authButton);
      });

      await waitFor(() => {
        expect(screen.getByText('认证方式: 二维码')).toBeInTheDocument();
        expect(screen.getByText('登录URL: https://www.zhihu.com/signin')).toBeInTheDocument();
        expect(screen.getByText('刷新间隔: 3000ms')).toBeInTheDocument();
      });
    });
  });

  describe('错误处理', () => {
    test('应该处理网络错误', async () => {
      electronAPI.platforms.findAll.mockRejectedValue(new Error('Network error'));

      render(<PlatformsPage />);

      await waitFor(() => {
        expect(screen.getByText('加载平台列表失败')).toBeInTheDocument();
        expect(message.error).toHaveBeenCalledWith('加载平台列表失败，请重试');
      });
    });

    test('应该提供重试功能', async () => {
      electronAPI.platforms.findAll.mockRejectedValueOnce(new Error('Network error'));

      render(<PlatformsPage />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /重试/i })).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: /重试/i });
      fireEvent.click(retryButton);

      // 应该重新开始加载
      expect(screen.getByText('正在加载平台列表...')).toBeInTheDocument();
    });
  });
});