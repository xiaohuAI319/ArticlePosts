import React from 'react';
import { Empty, Card } from 'antd';
import { FolderOutlined } from '@ant-design/icons';

function ArticlesPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">文章列表</h1>
        <p className="page-description">查看和管理所有文章，支持搜索和筛选功能</p>
      </div>

      <div className="page-content">
        <Card>
          <Empty
            image={<FolderOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
            description="文章列表功能开发中..."
          />
        </Card>
      </div>
    </div>
  );
}

export default ArticlesPage;