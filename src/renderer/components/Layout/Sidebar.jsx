import React from 'react';
import { Layout, Menu } from 'antd';
import {
  FileTextOutlined,
  SendOutlined,
  GlobalOutlined,
  SettingOutlined,
  HistoryOutlined,
  FolderOutlined,
  DesktopOutlined
} from '@ant-design/icons';
import { useDispatch, useSelector } from 'react-redux';
import { setCurrentPage } from '../../store/slices/appSlice';
import './Sidebar.css';

const { Sider } = Layout;

function Sidebar() {
  const dispatch = useDispatch();
  const { currentPage } = useSelector(state => state.app);
  const { currentArticle } = useSelector(state => state.articles);

  const menuItems = [
    {
      key: 'editor',
      icon: <FileTextOutlined />,
      label: '文章编辑'
    },
    {
      key: 'publish',
      icon: <SendOutlined />,
      label: '发布管理'
    },
    {
      key: 'platforms',
      icon: <GlobalOutlined />,
      label: '平台管理'
    },
    {
      key: 'articles',
      icon: <FolderOutlined />,
      label: '文章列表'
    },
    {
      key: 'history',
      icon: <HistoryOutlined />,
      label: '发布历史'
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: '设置'
    }
  ];

  const handleMenuClick = ({ key }) => {
    dispatch(setCurrentPage(key));
  };

  return (
    <Sider className="app-sidebar" theme="light">
      <div className="sidebar-header">
        <div className="logo">
          <FileTextOutlined />
        </div>
      </div>

      <Menu
        mode="inline"
        selectedKeys={[currentPage]}
        items={menuItems}
        onClick={handleMenuClick}
        className="sidebar-menu"
      />

      {currentArticle && (
        <div className="sidebar-footer">
          <div className="current-article-info">
            <div className="article-title">
              {currentArticle.title || '无标题'}
            </div>
            <div className="article-status">
              {currentArticle.status === 0 && '草稿'}
              {currentArticle.status === 1 && '已发布'}
              {currentArticle.status === 2 && '发布失败'}
            </div>
          </div>
        </div>
      )}
    </Sider>
  );
}

export default Sidebar;