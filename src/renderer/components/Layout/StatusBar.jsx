import React from 'react';
import { useSelector } from 'react-redux';
import { Layout, Space, Tag } from 'antd';
import {
  FileTextOutlined,
  SendOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import './StatusBar.css';

const { Footer } = Layout;

function StatusBar() {
  const { currentArticle, articles } = useSelector(state => state.articles);
  const { tasks, publishing } = useSelector(state => state.publish);
  const { platforms } = useSelector(state => state.platforms);

  // 统计信息
  const stats = {
    totalArticles: articles.length,
    publishedArticles: articles.filter(a => a.status === 1).length,
    draftArticles: articles.filter(a => a.status === 0).length,
    connectedPlatforms: platforms.filter(p => p.login_status === 'logged_in').length,
    activeTasks: tasks.filter(t => t.status === 'in_progress').length
  };

  return (
    <Footer className="status-bar">
      <div className="status-left">
        <Space size="large">
          <div className="status-item">
            <FileTextOutlined />
            <span>文章: {stats.totalArticles}</span>
            <Tag color="blue">{stats.draftArticles}草稿</Tag>
            <Tag color="green">{stats.publishedArticles}已发布</Tag>
          </div>

          <div className="status-item">
            <SendOutlined />
            <span>平台: {stats.connectedPlatforms}/{platforms.length}</span>
          </div>

          {publishing && (
            <div className="status-item publishing">
              <div className="publishing-indicator" />
              <span>正在发布 {stats.activeTasks} 个任务...</span>
            </div>
          )}
        </Space>
      </div>

      <div className="status-right">
        <Space size="middle">
          {currentArticle && (
            <div className="status-item">
              <span>当前: {currentArticle.title || '无标题'}</span>
              <Tag color={currentArticle.status === 0 ? 'orange' : currentArticle.status === 1 ? 'green' : 'red'}>
                {currentArticle.status === 0 && '草稿'}
                {currentArticle.status === 1 && '已发布'}
                {currentArticle.status === 2 && '发布失败'}
              </Tag>
            </div>
          )}

          <div className="status-item">
            <span>字数: {currentArticle?.word_count || 0}</span>
          </div>

          <div className="status-item">
            <span>阅读时间: {currentArticle?.reading_time || 0}分钟</span>
          </div>
        </Space>
      </div>
    </Footer>
  );
}

export default StatusBar;