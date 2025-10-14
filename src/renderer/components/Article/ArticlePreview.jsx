import React, { useState, useEffect } from 'react';
import { Card, Divider, Tag } from 'antd';
import { EyeOutlined, ClockCircleOutlined, FileTextOutlined } from '@ant-design/icons';
import './ArticlePreview.css';

function ArticlePreview({ content = '' }) {
  const [previewData, setPreviewData] = useState({
    title: '',
    content: '',
    wordCount: 0,
    readingTime: 0,
    headings: [],
    imageCount: 0
  });

  // 解析文章内容
  useEffect(() => {
    if (content) {
      parseArticleContent(content);
    }
  }, [content]);

  const parseArticleContent = (htmlContent) => {
    // 创建临时DOM来解析HTML
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlContent, 'text/html');

    // 提取标题
    const titleElement = doc.querySelector('h1, h2, h3');
    const title = titleElement ? titleElement.textContent.trim() : '无标题';

    // 提取纯文本内容
    const textContent = doc.body.textContent || '';
    const wordCount = textContent.length;
    const readingTime = Math.max(1, Math.ceil(wordCount / 500));

    // 提取所有标题
    const headings = Array.from(doc.querySelectorAll('h1, h2, h3, h4, h5, h6')).map(h => ({
      level: parseInt(h.tagName.charAt(1)),
      text: h.textContent.trim(),
      id: h.textContent.trim().replace(/\s+/g, '-').toLowerCase()
    }));

    // 统计图片数量
    const imageCount = doc.querySelectorAll('img').length;

    setPreviewData({
      title,
      content: htmlContent,
      wordCount,
      readingTime,
      headings,
      imageCount
    });
  };

  const renderContent = () => {
    if (!previewData.content) {
      return (
        <div className="preview-empty">
          <FileTextOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
          <p>暂无内容预览</p>
        </div>
      );
    }

    return (
      <div
        className="preview-content"
        dangerouslySetInnerHTML={{ __html: previewData.content }}
      />
    );
  };

  const renderTableOfContents = () => {
    if (previewData.headings.length === 0) return null;

    return (
      <div className="table-of-contents">
        <h4>目录</h4>
        <ul>
          {previewData.headings.map((heading, index) => (
            <li
              key={index}
              className={`heading-level-${heading.level}`}
              onClick={() => {
                const element = document.querySelector(`[data-heading-id="${heading.id}"]`);
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth' });
                }
              }}
            >
              {heading.text}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className="article-preview">
      {/* 文章信息 */}
      <div className="preview-header">
        <div className="preview-title">
          <h2>{previewData.title}</h2>
        </div>
        <div className="preview-meta">
          <div className="meta-item">
            <FileTextOutlined />
            <span>{previewData.wordCount} 字</span>
          </div>
          <div className="meta-item">
            <ClockCircleOutlined />
            <span>约 {previewData.readingTime} 分钟</span>
          </div>
          {previewData.imageCount > 0 && (
            <div className="meta-item">
              <EyeOutlined />
              <span>{previewData.imageCount} 张图片</span>
            </div>
          )}
        </div>
      </div>

      <Divider />

      {/* 目录 */}
      {renderTableOfContents()}
      {previewData.headings.length > 0 && <Divider />}

      {/* 内容预览 */}
      <div className="preview-body">
        {renderContent()}
      </div>

      {/* 文章底部信息 */}
      <div className="preview-footer">
        <div className="preview-tags">
          <Tag color="blue">草稿</Tag>
          {previewData.wordCount > 1000 && <Tag color="green">长文</Tag>}
          {previewData.imageCount > 0 && <Tag color="orange">图文</Tag>}
        </div>
      </div>
    </div>
  );
}

export default ArticlePreview;