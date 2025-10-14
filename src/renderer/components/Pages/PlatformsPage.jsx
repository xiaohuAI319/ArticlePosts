import React from 'react';
import { Empty, Card } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';

function PlatformsPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">平台管理</h1>
        <p className="page-description">配置发布平台，管理登录状态和发布设置</p>
      </div>

      <div className="page-content">
        <Card>
          <Empty
            image={<GlobalOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
            description="平台管理功能开发中..."
          />
        </Card>
      </div>
    </div>
  );
}

export default PlatformsPage;