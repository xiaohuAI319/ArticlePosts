import React from 'react';
import { Empty, Card } from 'antd';
import { HistoryOutlined } from '@ant-design/icons';

function HistoryPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">发布历史</h1>
        <p className="page-description">查看历史发布记录，管理已发布的文章</p>
      </div>

      <div className="page-content">
        <Card>
          <Empty
            image={<HistoryOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
            description="发布历史功能开发中..."
          />
        </Card>
      </div>
    </div>
  );
}

export default HistoryPage;