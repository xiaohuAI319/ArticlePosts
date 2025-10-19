import React, { useState, useEffect } from 'react';
import { Layout, Button, Space, Dropdown, Badge, Tooltip, message } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  FileTextOutlined,
  SaveOutlined,
  SendOutlined,
  SettingOutlined,
  UserOutlined,
  BellOutlined
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { openModal } from '../../store/slices/appSlice';
import { saveArticle } from '../../store/slices/articlesSlice';
import { publishArticle } from '../../store/slices/publishSlice';
import './Header.css';

const { Header: AntHeader } = Layout;

function Header({ collapsed, onToggle }) {
  const dispatch = useDispatch();
  const { currentArticle, saving } = useSelector(state => state.articles);
  // const { publishing, tasks } = useSelector(state => state.publish); // 暂时注释掉
  const { settings } = useSelector(state => state.app);

  // 临时设置默认值
  const publishing = false;
  const tasks = [];

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 监听文章变化
  useEffect(() => {
    // TODO: 实现未保存变化检测
    setHasUnsavedChanges(false);
  }, [currentArticle]);

  // 保存草稿
  const handleSave = async () => {
    if (!currentArticle) return;

    try {
      await dispatch(saveArticle({
        id: currentArticle.id,
        title: currentArticle.title,
        content: currentArticle.content,
        html_content: currentArticle.html_content
      })).unwrap();
    } catch (error) {
      console.error('保存失败:', error);
    }
  };

  // 一键发布
  const handlePublish = async () => {
    if (!currentArticle) {
      message.warning('请先创建或选择一篇文章');
      return;
    }

    // 获取可用的平台
    const availablePlatforms = ['zhihu']; // TODO: 从状态获取可用平台

    try {
      await dispatch(publishArticle({
        articleId: currentArticle.id,
        platformIds: availablePlatforms,
        config: {}
      })).unwrap();
    } catch (error) {
      console.error('发布失败:', error);
    }
  };

  // 新建文章
  const handleNewArticle = () => {
    dispatch(openModal('newArticle'));
  };

  // 平台管理
  const handlePlatformManage = () => {
    dispatch(openModal('platformManage'));
  };

  // 设置
  const handleSettings = () => {
    dispatch(openModal('settings'));
  };

  // 用户菜单
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料'
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置',
      onClick: handleSettings
    },
    {
      type: 'divider'
    },
    {
      key: 'about',
      label: '关于'
    }
  ];

  return (
    <AntHeader className="app-header">
      <div className="header-left">
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          onClick={onToggle}
          className="trigger-button"
        />

        <div className="app-title">
          <FileTextOutlined className="app-icon" />
          <span>文章多发助手</span>
        </div>
      </div>

      <div className="header-center">
        {currentArticle && (
          <Space>
            <span className="article-title">
              {currentArticle.title || '无标题文章'}
            </span>
            {hasUnsavedChanges && (
              <Badge dot color="orange">
                <span className="unsaved-indicator">未保存</span>
              </Badge>
            )}
          </Space>
        )}
      </div>

      <div className="header-right">
        <Space size="middle">
          {/* 操作按钮 */}
          {currentArticle && (
            <>
              <Tooltip title="保存草稿 (Ctrl+S)">
                <Button
                  type="text"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={saving}
                  disabled={!hasUnsavedChanges}
                >
                  保存
                </Button>
              </Tooltip>

              <Tooltip title="一键发布 (Ctrl+Enter)">
                <Button
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={handlePublish}
                  loading={publishing}
                  disabled={!currentArticle.title || !currentArticle.content}
                >
                  发布
                </Button>
              </Tooltip>
            </>
          )}

          {/* 通知 */}
          <Tooltip title="通知">
            <Button type="text" icon={<BellOutlined />} />
          </Tooltip>

          {/* 用户菜单 */}
          <Dropdown
            menu={{ items: userMenuItems }}
            placement="bottomRight"
            trigger={['click']}
          >
            <Button type="text" icon={<UserOutlined />} />
          </Dropdown>
        </Space>
      </div>
    </AntHeader>
  );
}

export default Header;