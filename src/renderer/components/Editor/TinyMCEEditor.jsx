import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { useDispatch, useSelector } from 'react-redux';
import { updateCurrentArticle } from '../../store/slices/articleSlice';
import FeishuPasteHandler from './FeishuPasteHandler';
import './TinyMCEEditor.css';

// TinyMCE配置
const TINYMCE_CONFIG = {
  height: '100%',
  menubar: false,
  plugins: [
    'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
    'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
    'insertdatetime', 'media', 'table', 'help', 'wordcount'
  ],
  toolbar: [
    'undo redo | formatselect | bold italic backcolor |',
    'alignleft aligncenter alignright alignjustify |',
    'bullist numlist outdent indent | removeformat | help',
    'link image | code | fullscreen | preview'
  ].join(' '),
  content_style: `
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-size: 14px;
      line-height: 1.6;
      margin: 16px;
    }
    h1 { font-size: 24px; font-weight: bold; margin: 16px 0 8px 0; }
    h2 { font-size: 20px; font-weight: bold; margin: 14px 0 7px 0; }
    h3 { font-size: 16px; font-weight: bold; margin: 12px 0 6px 0; }
    p { margin: 8px 0; }
    img { max-width: 100%; height: auto; }
    blockquote {
      border-left: 4px solid #ddd;
      margin: 16px 0;
      padding-left: 16px;
      color: #666;
    }
    pre {
      background: #f5f5f5;
      padding: 12px;
      border-radius: 4px;
      overflow-x: auto;
    }
    code {
      background: #f5f5f5;
      padding: 2px 4px;
      border-radius: 3px;
      font-family: 'Courier New', monospace;
    }
  `,
  // 粘贴处理
  paste_data_images: true,
  paste_as_text: false,
  automatic_uploads: true,
  images_upload_handler: async (blobInfo, progress) => {
    // 这里暂时返回blob URL，后续会完善图片处理
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blobInfo.blob());
      resolve(url);
    });
  },
  // 自动保存 - 简化配置，避免API问题
  setup: (editor) => {
    // 编辑器初始化完成事件
    editor.on('init', () => {
      console.log('TinyMCE编辑器初始化完成');
    });
  }
};

function TinyMCEEditor({ initialContent = '', placeholder = '开始编写你的文章...' }) {
  const dispatch = useDispatch();
  const { currentArticle } = useSelector(state => state.articles);
  const [content, setContent] = useState(initialContent);
  const editorRef = useRef(null);
  const [isEditorReady, setIsEditorReady] = useState(false);
  const [wordCount, setWordCount] = useState(0);
  const [readingTime, setReadingTime] = useState(0);
  const [tinyMCEApiKey, setTinyMCEApiKey] = useState(null); // 改为null，表示还未加载
  const autoSaveTimerRef = useRef(null);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // 加载TinyMCE API key
  useEffect(() => {
    const loadApiKey = async () => {
      try {
        if (window.electronAPI && window.electronAPI.config) {
          const apiKey = await window.electronAPI.config.get('tinymce.apiKey');
          if (apiKey) {
            setTinyMCEApiKey(apiKey);
          } else {
            // 如果无法获取API key，使用默认值避免编辑器无法加载
            setTinyMCEApiKey('no-api-key');
          }
        } else {
          // 如果electronAPI不可用，使用默认值
          setTinyMCEApiKey('no-api-key');
        }
      } catch (error) {
        console.error('加载TinyMCE API key 失败:', error);
        // 出错时使用默认值
        setTinyMCEApiKey('no-api-key');
      }
    };

    loadApiKey();
  }, []);

  // 计算字数和阅读时间
  const calculateStats = (htmlContent) => {
    // 移除HTML标签计算纯文本字数
    const textContent = htmlContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    const words = textContent.length;
    const readingMinutes = Math.max(1, Math.ceil(words / 500)); // 假设每分钟500字

    setWordCount(words);
    setReadingTime(readingMinutes);
  };

  // 自动保存函数
  const triggerAutoSave = useCallback(() => {
    if (editorRef.current && typeof editorRef.current.getContent === 'function') {
      try {
        const editor = editorRef.current;
        const editorContent = editor.getContent();
        const title = editor.dom.select('h1, h2, h3')[0]?.innerText || '无标题';

        dispatch(updateCurrentArticle({
          title: title.trim(),
          content: editorContent,
          updatedAt: new Date().toISOString()
        }));
      } catch (error) {
        console.error('自动保存失败:', error);
      }
    }
  }, [dispatch]);

  // 处理编辑器内容变化
  const handleEditorChange = (newContent, editor) => {
    setContent(newContent);
    calculateStats(newContent);

    // 实时更新Redux store
    const title = editor.dom.select('h1, h2, h3')[0]?.innerText || '无标题';

    dispatch(updateCurrentArticle({
      title: title.trim(),
      content: newContent,
      updatedAt: new Date().toISOString()
    }));

    // 重置自动保存定时器
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }

    // 设置新的自动保存定时器（30秒）
    autoSaveTimerRef.current = setTimeout(() => {
      triggerAutoSave();
    }, 30000);
  };

  // 处理编辑器初始化
  const handleEditorInit = (editor) => {
    // 延迟验证，确保编辑器完全初始化
    setTimeout(() => {
      // 验证编辑器对象
      if (!editor || typeof editor.focus !== 'function') {
        console.error('编辑器对象无效或API不可用');
        // 如果编辑器API不可用，可能是只读模式，仍然标记为已初始化
        setIsEditorReady(true);
        return;
      }

      editorRef.current = editor;
      setIsEditorReady(true);

      // 如果有初始内容，设置到编辑器
      if (initialContent) {
        try {
          editor.setContent(initialContent);
          calculateStats(initialContent);
        } catch (error) {
          console.error('设置初始内容失败:', error);
        }
      }

      // 设置焦点
      setTimeout(() => {
        try {
          if (editor && typeof editor.focus === 'function') {
            editor.focus();
          }
        } catch (error) {
          console.error('设置焦点失败:', error);
        }
      }, 100);
    }, 500); // 增加延迟时间确保编辑器完全初始化
  };

  // 监听外部内容变化
  useEffect(() => {
    if (isEditorReady && editorRef.current && currentArticle?.content !== content) {
      const editor = editorRef.current;

      // 验证编辑器API可用
      if (typeof editor.getContent === 'function' && typeof editor.setContent === 'function') {
        try {
          const currentEditorContent = editor.getContent();

          // 只有当外部内容与编辑器内容不同时才更新
          if (currentArticle?.content && currentArticle.content !== currentEditorContent) {
            editor.setContent(currentArticle.content);
            setContent(currentArticle.content);
            calculateStats(currentArticle.content);
          }
        } catch (error) {
          console.error('更新编辑器内容失败:', error);
        }
      }
    }
  }, [currentArticle?.content, isEditorReady]);

  // 处理键盘快捷键
  useEffect(() => {
    const handleKeyDown = (event) => {
      // Ctrl+S 保存
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        handleManualSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [content]);

  // 手动保存
  const handleManualSave = () => {
    if (editorRef.current && typeof editorRef.current.getContent === 'function') {
      const editor = editorRef.current;
      try {
        const title = editor.dom.select('h1, h2, h3')[0]?.innerText || '无标题';
        const editorContent = editor.getContent();

        dispatch(updateCurrentArticle({
          title: title.trim(),
          content: editorContent,
          updatedAt: new Date().toISOString()
        }));

        } catch (error) {
        console.error('手动保存失败:', error);
      }
    }
  };

  return (
    <div className="tinymce-editor-container">
      {/* 编辑器工具栏 */}
      <div className="editor-toolbar">
        <div className="editor-stats">
          <span className="word-count">字数: {wordCount}</span>
          <span className="reading-time">阅读时间: {readingTime}分钟</span>
        </div>
        <div className="editor-actions">
          <button
            className="save-button"
            onClick={handleManualSave}
            title="保存 (Ctrl+S)"
          >
            保存
          </button>
        </div>
      </div>

      {/* TinyMCE编辑器 */}
      <div className="editor-wrapper">
        {!tinyMCEApiKey && (
          <div className="editor-loading">
            正在加载编辑器配置...
          </div>
        )}
        {tinyMCEApiKey && (
          <>
            {!isEditorReady && (
              <div className="editor-loading">
                正在初始化编辑器...
              </div>
            )}
            <Editor
              apiKey={tinyMCEApiKey} // 从配置动态加载API key
              value={content}
              init={TINYMCE_CONFIG}
              onInit={handleEditorInit}
              onEditorChange={handleEditorChange}
              onAutoSave={handleManualSave}
            />
          </>
        )}
      </div>

      {/* 飞书格式粘贴处理器 */}
      {isEditorReady && editorRef.current && <FeishuPasteHandler editor={editorRef.current} />}
    </div>
  );
}

export default TinyMCEEditor;