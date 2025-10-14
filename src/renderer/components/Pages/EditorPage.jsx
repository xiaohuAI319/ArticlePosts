import React from 'react';
import { Empty, Card } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';

function EditorPage() {
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">文章编辑</h1>
        <p className="page-description">编辑文章内容，支持富文本编辑和实时预览</p>
      </div>

      <div className="page-content">
        <Card>
          <Empty
            image={<FileTextOutlined style={{ fontSize: 64, color: '#d9d9d9' }} />}
            description={
              <span>
                富文本编辑器功能开发中...
                <br />
                即将支持TinyMCE集成和飞书格式粘贴
              </span>
            }
          />
        </Card>
      </div>
    </div>
  );
}

export default EditorPage;