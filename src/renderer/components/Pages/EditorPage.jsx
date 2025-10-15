import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Card, Row, Col, Button, message, Input } from 'antd';
import { PlusOutlined, SaveOutlined } from '@ant-design/icons';
import TinyMCEEditor from '../Editor/TinyMCEEditor';
import ArticlePreview from '../Article/ArticlePreview';
import { createNewArticle, updateCurrentArticle, autoSaveArticle, fetchArticles, setCurrentArticle } from '../../store/slices/articleSlice';
import './EditorPage.css';

const { TextArea } = Input;

function EditorPage() {
  const dispatch = useDispatch();
  const { currentArticle, saving, editorState } = useSelector(state => state.articles);
  const [showPreview, setShowPreview] = React.useState(false);

  // 初始化：先尝试加载最近的文章，如果没有则创建新文章
  useEffect(() => {
    const initializeArticle = async () => {
      if (!currentArticle) {
        try {
          // 尝试获取最近的文章（按更新时间倒序，只获取1篇）
          const result = await dispatch(fetchArticles({
            limit: 1,
            offset: 0,
            orderBy: 'updated_at',
            order: 'DESC'
          })).unwrap();

          if (result.success && result.data?.articles?.length > 0) {
            // 加载最近的文章
            const recentArticle = result.data.articles[0];
            dispatch(setCurrentArticle(recentArticle));
          } else {
            // 没有文章，创建新文章
            dispatch(createNewArticle());
          }
        } catch (error) {
          console.error('加载文章失败:', error);
          // 出错时创建新文章
          dispatch(createNewArticle());
        }
      }
    };

    initializeArticle();
  }, [currentArticle, dispatch]);

  // 创建新文章
  const handleNewArticle = () => {
    dispatch(createNewArticle());
    message.success('新文章已创建');
  };

  // 保存文章
  const handleSaveArticle = async () => {
    // 检查是否有有效的标题和内容
    const hasValidTitle = currentArticle?.title && currentArticle.title !== '无标题';
    const hasValidContent = currentArticle?.content && currentArticle.content.trim() !== '';

    if (hasValidTitle && hasValidContent) {
      try {
        const result = await dispatch(autoSaveArticle({
          ...currentArticle,
          updatedAt: new Date().toISOString()
        })).unwrap();

        if (result.success) {
          message.success('文章已保存');
          // 更新currentArticle以反映最新的保存时间
          const savedArticle = result.data || result;
          if (savedArticle) {
            dispatch(setCurrentArticle(savedArticle));
          }
        } else {
          message.error(result.message || '保存失败，请重试');
        }
      } catch (error) {
        console.error('保存失败:', error);
        message.error('保存失败，请重试');
      }
    } else {
      if (!hasValidTitle && !hasValidContent) {
        message.warning('请先填写标题并编写文章内容');
      } else if (!hasValidTitle) {
        message.warning('请先填写有效的文章标题');
      } else {
        message.warning('请先编写文章内容');
      }
    }
  };

  // 标题变化处理
  const handleTitleChange = (e) => {
    const title = e.target.value.trim();
    dispatch(updateCurrentArticle({
      ...currentArticle,
      title: title,
      updatedAt: new Date().toISOString()
    }));
  };

  // 标题框获得焦点时的处理
  const handleTitleFocus = (e) => {
    // 如果标题是默认的"无标题"，则清空
    if (e.target.value === '无标题') {
      e.target.select();
    }
  };

  // 标题框按下键盘时的处理
  const handleTitleKeyDown = (e) => {
    // 如果标题是"无标题"且用户开始输入，则清空
    if (e.target.value === '无标题' && e.key.length === 1) {
      e.target.value = '';
    }
  };

  // 切换预览模式
  const togglePreview = () => {
    setShowPreview(!showPreview);
  };

  
  // 全局快捷键处理
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ctrl+S 保存
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        handleSaveArticle();
      }
    };

    // 添加全局事件监听器
    document.addEventListener('keydown', handleKeyDown);

    // 清理函数
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentArticle, dispatch]);

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
            loading={saving}
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
        {/* 标题输入区域 */}
        <div className="title-section">
          <Card className="title-card" styles={{ body: { padding: '16px' } }}>
            <Input
              placeholder="请输入文章标题"
              value={currentArticle?.title || '无标题'}
              onChange={handleTitleChange}
              onFocus={handleTitleFocus}
              onKeyDown={handleTitleKeyDown}
              size="large"
              maxLength={100}
              showCount
              style={{ fontSize: '18px', fontWeight: 'bold' }}
            />
          </Card>
        </div>

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
              styles={{ body: { padding: 0, height: '550px' } }}
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
                styles={{ body: { padding: '16px', height: '600px', overflow: 'auto' } }}
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

        {/* 保存状态显示 */}
        <div className="save-status">
          {currentArticle && (
            <span>
              最后保存: {editorState?.lastSaved
                ? (() => {
                    const formattedTime = new Date(editorState.lastSaved).toLocaleString('zh-CN');
                    return formattedTime;
                  })()
                : '未保存'
              }
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default EditorPage;