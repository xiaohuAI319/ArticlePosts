import React, { useEffect, useState } from 'react';
import { Layout, message } from 'antd';
import { useDispatch, useSelector } from 'react-redux';
import Header from './components/Layout/Header';
import Sidebar from './components/Layout/Sidebar';
import ContentArea from './components/Layout/ContentArea';
import StatusBar from './components/Layout/StatusBar';
import { initializeApp } from './store/slices/appSlice';
import './styles/App.css';

const { Header: AntHeader, Sider, Content } = Layout;

function App() {
  const dispatch = useDispatch();
  const { loading, initialized } = useSelector(state => state.app);
  const [collapsed, setCollapsed] = useState(false);

  // 应用初始化
  useEffect(() => {
    const initApp = async () => {
      try {
        await dispatch(initializeApp()).unwrap();
        message.success('应用启动成功');
      } catch (error) {
        console.error('应用初始化失败:', error);
        message.error('应用启动失败，请重试');
      }
    };

    initApp();
  }, [dispatch]);

  // 监听菜单事件
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onMenuAction((event, action) => {
        switch (action) {
        case 'menu-new-article':
          // TODO: 新建文章
          message.info('新建文章功能开发中...');
          break;
        case 'menu-save-draft':
          // TODO: 保存草稿
          message.info('保存草稿功能开发中...');
          break;
        case 'menu-publish':
          // TODO: 一键发布
          message.info('一键发布功能开发中...');
          break;
        case 'menu-platform-manage':
          // TODO: 平台管理
          message.info('平台管理功能开发中...');
          break;
        default:
          break;
        }
      });
    }

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('menu-new-article');
        window.electronAPI.removeAllListeners('menu-save-draft');
        window.electronAPI.removeAllListeners('menu-publish');
        window.electronAPI.removeAllListeners('menu-platform-manage');
      }
    };
  }, []);

  if (loading || !initialized) {
    return (
      <Layout className="app-loading">
        <Content>
          <div className="loading-container">
            <div className="loading-spinner" />
            <p>正在初始化应用...</p>
          </div>
        </Content>
      </Layout>
    );
  }

  return (
    <Layout className="app-layout">
      <AntHeader className="app-header">
        <Header collapsed={collapsed} onToggle={setCollapsed} />
      </AntHeader>

      <Layout>
        <Sider
          collapsible
          collapsed={collapsed}
          onCollapse={setCollapsed}
          className="app-sidebar"
          width={200}
          collapsedWidth={60}
        >
          <Sidebar />
        </Sider>

        <Layout>
          <Content className="app-content">
            <ContentArea />
          </Content>
        </Layout>
      </Layout>

      <StatusBar />
    </Layout>
  );
}

export default App;