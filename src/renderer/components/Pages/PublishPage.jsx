import React from 'react';
import { Empty, Card } from 'antd';
import { SendOutlined } from '@ant-design/icons';

function PublishPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">发布管理</h1>
        <p className="page-description">管理发布任务，查看发布状态和历史记录</p>
      </div>

      <div className="page-content">
        <Card>
          <Empty
            image={<SendOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
            description="发布管理功能开发中..."
          />
        </Card>
      </div>
    </div>
  );
}

export default PublishPage;