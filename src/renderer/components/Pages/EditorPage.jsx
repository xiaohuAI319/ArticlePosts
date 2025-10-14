import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Card, Row, Col, Button, message } from 'antd';
import { PlusOutlined, SaveOutlined } from '@ant-design/icons';
import TinyMCEEditor from '../Editor/TinyMCEEditor';
import ArticlePreview from '../Article/ArticlePreview';
import { createNewArticle, updateCurrentArticle } from '../../store/slices/articleSlice';
import './EditorPage.css';

function EditorPage() {
  const dispatch = useDispatch();
  const { currentArticle, isLoading } = useSelector(state => state.articles);
  const [showPreview, setShowPreview] = React.useState(false);

  // 初始化新文章
  useEffect(() => {
    if (!currentArticle) {
      dispatch(createNewArticle());
    }
  }, [currentArticle, dispatch]);

  // 创建新文章
  const handleNewArticle = () => {
    dispatch(createNewArticle());
    message.success('新文章已创建');
  };

  // 保存文章
  const handleSaveArticle = () => {
    if (currentArticle?.title && currentArticle?.content) {
      dispatch(updateCurrentArticle({
        ...currentArticle,
        updatedAt: new Date().toISOString()
      }));
      message.success('文章已保存');
    } else {
      message.warning('请先编写文章内容');
    }
  };

  // 切换预览模式
  const togglePreview = () => {
    setShowPreview(!showPreview);
  };

  return (
    <div className="page-container editor-page">
      <div className="page-header">
        <div className="header-left">
          <h1 className="page-title">文章编辑</h1>
          <p className="page-description">
            支持富文本编辑和实时预览，兼容飞书文档格式
          </p>
        </div>
        <div className="header-actions">
          <Button
            type="default"
            icon={<PlusOutlined />}
            onClick={handleNewArticle}
          >
            新建文章
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSaveArticle}
            loading={isLoading}
          >
            保存文章
          </Button>
          <Button
            type={showPreview ? 'primary' : 'default'}
            onClick={togglePreview}
          >
            {showPreview ? '编辑模式' : '预览模式'}
          </Button>
        </div>
      </div>

      <div className="page-content">
        <Row gutter={[16, 16]} className="editor-row">
          {/* 编辑区域 */}
          <Col xs={24} md={showPreview ? 12 : 24} className="editor-col">
            <Card
              title={
                <div className="card-title">
                  <span>编辑器</span>
                  {currentArticle && (
                    <span className="article-status">
                      {currentArticle.status === 0 && '草稿'}
                      {currentArticle.status === 1 && '已发布'}
                      {currentArticle.status === 2 && '发布失败'}
                    </span>
                  )}
                </div>
              }
              className="editor-card"
              bodyStyle={{ padding: 0, height: '600px' }}
            >
              {currentArticle ? (
                <TinyMCEEditor
                  initialContent={currentArticle.content || ''}
                  placeholder="开始编写你的文章，支持从飞书文档粘贴内容..."
                />
              ) : (
                <div className="editor-placeholder">
                  <div className="placeholder-content">
                    <PlusOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                    <p>正在创建新文章...</p>
                  </div>
                </div>
              )}
            </Card>
          </Col>

          {/* 预览区域 */}
          {showPreview && (
            <Col xs={24} md={12} className="preview-col">
              <Card
                title={
                  <div className="card-title">
                    <span>预览</span>
                    {currentArticle && (
                      <span className="preview-stats">
                        {currentArticle.wordCount || 0} 字
                        {currentArticle.readingTime && ` · ${currentArticle.readingTime} 分钟`}
                      </span>
                    )}
                  </div>
                }
                className="preview-card"
                bodyStyle={{ padding: '16px', height: '600px', overflow: 'auto' }}
              >
                {currentArticle?.content ? (
                  <ArticlePreview content={currentArticle.content} />
                ) : (
                  <div className="preview-placeholder">
                    <p>暂无内容预览</p>
                  </div>
                )}
              </Card>
            </Col>
          )}
        </Row>

        {/* 快捷工具栏 */}
        <div className="editor-toolbar">
          <div className="toolbar-info">
            {currentArticle && (
              <span>
                最后保存: {currentArticle.updatedAt
                  ? new Date(currentArticle.updatedAt).toLocaleString('zh-CN')
                  : '未保存'
                }
              </span>
            )}
          </div>
          <div className="toolbar-actions">
            <Button size="small" type="link" onClick={() => message.info('格式化功能开发中...')}>
              格式化
            </Button>
            <Button size="small" type="link" onClick={() => message.info('导入功能开发中...')}>
              导入
            </Button>
            <Button size="small" type="link" onClick={() => message.info('导出功能开发中...')}>
              导出
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditorPage;