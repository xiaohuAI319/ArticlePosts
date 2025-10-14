import React from 'react';
import { Empty, Card } from 'antd';
import { SettingOutlined } from '@ant-design/icons';

function SettingsPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">设置</h1>
        <p className="page-description">配置应用设置，包括发布选项、界面主题等</p>
      </div>

      <div className="page-content">
        <Card>
          <Empty
            image={<SettingOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
            description="设置功能开发中..."
          />
        </Card>
      </div>
    </div>
  );
}

export default SettingsPage;