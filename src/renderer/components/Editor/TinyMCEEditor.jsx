import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import { useDispatch, useSelector } from 'react-redux';
import { message } from 'antd';
import { updateCurrentArticle, autoSaveArticle } from '../../store/slices/articleSlice';
import FeishuPasteHandler from './FeishuPasteHandler';
import './TinyMCEEditor.css';

// TinyMCE配置
const TINYMCE_CONFIG = {
  height: '100%',
  menubar: false,
  statusbar: false, // 隐藏底部状态栏
  // 品牌和推广配置
  branding: false, // 移除"Powered by TinyMCE"品牌
  promotion: false, // 移除升级推广链接
  content_css: false, // 移除CSS推广
  visual: false, // 移除视觉块工具栏的推广
  // 禁用统计和监控
  disable_notifications: true, // 禁用通知
  plugins_extend: false, // 禁用插件扩展
  toolbar_extend: false, // 禁用工具栏扩展
  custom_undo_redo_levels: 10, // 限制撤销重做级别
  // 网络和CDN配置 - 完全禁用网络请求
  images_upload_url: null, // 禁用图片上传到CDN
  images_reuse_filename: true, // 重用文件名
  relative_urls: false, // 禁用相对URL
  remove_script_host: true, // 移除脚本主机
  convert_urls: false, // 禁用URL转换
  // 使用本地资源
  language: 'zh_CN',
  language_url: '/tinymce/langs/zh_CN.js',
  skin_url: '/tinymce/skins/ui/oxide',
  content_css: '/tinymce/skins/content/default/content.css',
  content_css_cors: false, // 禁用外部CSS加载
  importcss_append: false, // 禁用CSS导入
  importcss_prepend: false,
  custom_elements: '', // 禁用自定义元素检测
  // 强制禁用所有外部资源加载
  cache_suffix: '?v=0', // 禁用缓存
  forced_root_block: 'p', // 强制使用p标签
  schema: 'html5', // 使用HTML5 schema
  verify_html: false, // 禁用HTML验证
  entity_encoding: 'raw', // 原始编码
  remove_linebreaks: false, // 保留换行符
  fix_nesting: false, // 禁用嵌套修复
  fix_list_elements: false, // 禁用列表修复
  // 禁用可能引起网络请求的功能
  spellchecker_languages: [], // 禁用拼写检查
  spellchecker_rpc_url: null, // 禁用拼写检查RPC
  help_tabs: ['versions'], // 简化帮助页面
  plugins: [
    'advlist',
    'autolink',
    'lists',
    'link',
    'charmap',
    'anchor',
    'searchreplace',
    'code',
    'fullscreen',
    'insertdatetime',
    'table'
  ],
  toolbar: [
    'undo redo | formatselect | bold italic backcolor |',
    'alignleft aligncenter alignright alignjustify |',
    'bullist numlist outdent indent | removeformat',
    'link | code | fullscreen'
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
  automatic_uploads: false, // 禁用自动上传避免网络请求
  paste_preprocess: (plugin, args) => {
    // 预处理粘贴内容，移除可能引起网络请求的元素
    let content = args.content;
    // 移除外部图片链接，转换为本地blob URL
    content = content.replace(/<img[^>]*src=["']https?:\/\/[^"']*["'][^>]*>/gi, (match) => {
      // 这里可以添加图片下载和本地化逻辑
      return match; // 暂时保留原样
    });
    args.content = content;
  },
  images_upload_handler: async (blobInfo, progress) => {
    // 本地处理图片，避免网络上传
    return new Promise((resolve) => {
      const url = URL.createObjectURL(blobInfo.blob());
      resolve(url);
    });
  },
  // 集成飞书粘贴处理
  setup: (editor) => {
    // 编辑器初始化完成事件
    editor.on('init', () => {
      // 编辑器初始化成功
      // 禁用自动保存到云端
      if (editor.settings) {
        editor.settings.save_enablewhendirty = false;
        editor.settings.save_onsavecallback = null;
      }
    });

    // 添加错误处理
    editor.on('error', (error) => {
      console.error('TinyMCE编辑器错误:', error);
    });

    // 禁用可能引起网络请求的功能
    editor.on('ObjectResized', (e) => {
      // 处理对象调整大小事件，避免网络请求
    });

  
    // 添加飞书粘贴处理器
    editor.on('paste', (event) => {
      const clipboardData = event.clipboardData || window.clipboardData;
      if (!clipboardData) return;

      const htmlContent = clipboardData.getData('text/html');

      if (htmlContent) {
        // 检测飞书内容特征
        const feishuIndicators = [
          'data-feishu-', 'feishu-', 'lark-', 'bytedance',
          'feishu-block', 'feishu-text', 'feishu-image', 'feishu-table',
          '<meta name="generator" content="feishu"',
          'feishu.cn', 'larksuite.com'
        ];

        const isFeishu = feishuIndicators.some(indicator =>
          htmlContent.toLowerCase().includes(indicator)
        );

        if (isFeishu) {
          event.preventDefault();

          try {
            // 转换飞书格式
            let convertedContent = htmlContent;

            // 转换代码块
            const codeBlockPatterns = [
              {
                pattern: /<div[^>]*class="[^"]*feishu-code-block[^"]*"[^>]*>(.*?)<\/div>/gis,
                replacement: '<pre><code>$1</code></pre>'
              },
              {
                pattern: /<div[^>]*class="[^"]*feishu-code[^"]*"[^>]*data-language="([^"]*)"[^>]*>(.*?)<\/div>/gis,
                replacement: (match, language, code) => {
                  return `<pre><code class="language-${language || 'text'}">${code}</code></pre>`;
                }
              },
              {
                pattern: /<div[^>]*class="[^"]*code-block[^"]*"[^>]*>(.*?)<\/div>/gis,
                replacement: '<pre><code>$1</code></pre>'
              }
            ];

            codeBlockPatterns.forEach(rule => {
              convertedContent = convertedContent.replace(rule.pattern, rule.replacement);
            });

            // 转换图片
            convertedContent = convertedContent.replace(
              /<img[^>]*data-src="([^"]*)"[^>]*data-feishu[^>]*>/gi,
              (match, src) => match.replace(/data-src="/g, 'src="')
            );

            // 清理飞书属性
            convertedContent = convertedContent
              .replace(/\s*data-feishu-[^=]*="[^"]*"/gi, '')
              .replace(/\s*class="[^"]*feishu-[^"]*"/gi, '');

            // 插入转换后的内容
            editor.insertContent(convertedContent);
            message.success('飞书格式已转换并保持');
          } catch (error) {
            message.error('格式转换失败，已插入纯文本');
            const plainText = clipboardData.getData('text/plain');
            if (plainText) {
              editor.insertContent(`<p>${plainText}</p>`);
            }
          }
        }
      }
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
    // 添加全局错误处理器，捕获TinyMCE相关的网络错误
    const handleUnhandledRejection = (event) => {
      if (event.reason && event.reason.message && event.reason.message.includes('Failed to fetch')) {
        // 静默处理TinyMCE的网络请求错误
        event.preventDefault();
        console.warn('TinyMCE网络请求已被拦截:', event.reason);
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    // 强制拦截所有网络请求
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, ...args) {
      // 智能拦截XMLHttpRequest - 只拦截可疑的TinyMCE请求
      if (url && typeof url === 'string') {
        // 允许白名单域名和TinyMCE核心CDN
        const allowedDomains = ['localhost', '127.0.0.1', '0.0.0.0', 'cdn.tiny.cloud'];
        const isAllowed = allowedDomains.some(domain => url.includes(domain));

        // 阻止已知的TinyMCE推广和统计请求，但允许核心功能
        const blockedPatterns = [
          // 推广和统计相关
          'tinymce.com/analytics',
          'tinymce.cloud/track',
          'tiny.cloud/stats',
          'tiny.cloud/telemetry',
          // 不必要的插件和资源
          'emoji-converter',
          ' mentions',
          'autolink/c',
          'linkchecker',
          'media/embed',
          'paste/importword',
          // 推广内容
          'powered-by',
          'upgrade-promo',
          'branding'
        ];

        const isBlocked = blockedPatterns.some(pattern => url.includes(pattern));

        if (!isAllowed && (url.startsWith('http://') || url.startsWith('https://')) && isBlocked) {
          console.warn('TinyMCE网络请求已被拦截:', url);
          throw new Error('Network request blocked by TinyMCE security policy');
        }
      }
      return originalXHROpen.call(this, method, url, ...args);
    };

    XMLHttpRequest.prototype.send = function(...args) {
      try {
        return originalXHRSend.apply(this, args);
      } catch (error) {
        // 静默处理网络请求错误
        console.warn('网络请求已被拦截:', error.message);
        return;
      }
    };

    // 智能拦截fetch请求 - 只拦截可疑的TinyMCE请求
    const originalFetch = window.fetch;
    window.fetch = function(url, options) {
      if (url && typeof url === 'string') {
        // 允许白名单域名和TinyMCE核心CDN
        const allowedDomains = ['localhost', '127.0.0.1', '0.0.0.0', 'cdn.tiny.cloud'];
        const isAllowed = allowedDomains.some(domain => url.includes(domain));

        // 阻止已知的TinyMCE推广和统计请求，但允许核心功能
        const blockedPatterns = [
          // 推广和统计相关
          'tinymce.com/analytics',
          'tinymce.cloud/track',
          'tiny.cloud/stats',
          'tiny.cloud/telemetry',
          // 不必要的插件和资源
          'emoji-converter',
          ' mentions',
          'autolink/c',
          'linkchecker',
          'media/embed',
          'paste/importword',
          // 推广内容
          'powered-by',
          'upgrade-promo',
          'branding'
        ];

        const isBlocked = blockedPatterns.some(pattern => url.includes(pattern));

        if (!isAllowed && (url.startsWith('http://') || url.startsWith('https://')) && isBlocked) {
          console.warn('TinyMCE网络请求已被拦截:', url);
          return Promise.reject(new Error('Fetch request blocked by TinyMCE security policy'));
        }
      }
      return originalFetch.apply(this, arguments);
    };

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

    // 清理函数
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      // 恢复原始的网络请求方法
      XMLHttpRequest.prototype.open = originalXHROpen;
      XMLHttpRequest.prototype.send = originalXHRSend;
      window.fetch = originalFetch;
    };
  }, []);

  // 计算字数和阅读时间
  const calculateStats = (htmlContent) => {
    // 移除HTML标签计算纯文本字数
    const textContent = htmlContent.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    // 计算中文字符数（包括中文标点）和英文单词数
    const chineseChars = (textContent.match(/[\u4e00-\u9fa5]/g) || []).length;
    const englishWords = (textContent.match(/[a-zA-Z]+/g) || []).length;
    const numbers = (textContent.match(/\d/g) || []).length;
    const punctuation = (textContent.match(/[^\w\s\u4e00-\u9fa5]/g) || []).length;
    const totalWords = chineseChars + englishWords + numbers + punctuation;
    const readingMinutes = Math.max(1, Math.ceil(totalWords / 500)); // 假设每分钟500字

    setWordCount(totalWords);
    setReadingTime(readingMinutes);
  };

  // 自动保存函数
  const triggerAutoSave = useCallback(() => {
    if (editorRef.current && typeof editorRef.current.getContent === 'function' && currentArticle) {
      try {
        const editor = editorRef.current;
        const editorContent = editor.getContent();

        // 使用ArticleService自动保存，保持用户输入的标题不变
        dispatch(autoSaveArticle({
          ...currentArticle,
          content: editorContent,
          updatedAt: new Date().toISOString()
        }));
        // 自动保存使用静默模式，不打扰用户
      } catch (error) {
        // 静默处理自动保存错误，避免打扰用户
      }
    }
  }, [dispatch, currentArticle]);

  // 处理编辑器内容变化
  const handleEditorChange = (newContent, editor) => {
    setContent(newContent);
    calculateStats(newContent);

    // 禁用自动提取标题功能，完全依赖用户手动输入
    // 只更新内容和时间，不修改标题
    dispatch(updateCurrentArticle({
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
  const handleEditorInit = (event) => {
    // 从事件对象中获取真正的编辑器实例
    const editor = event.target;

    // 立即设置编辑器引用
    editorRef.current = editor;
    setIsEditorReady(true);

    // 验证编辑器对象
    if (!editor) {
      console.error('编辑器对象为空');
      return;
    }

    // 如果有初始内容，直接设置
    if (initialContent) {
      try {
        // 使用TinyMCE的标准API
        editor.setContent(initialContent);
        calculateStats(initialContent);
      } catch (error) {
        console.error('设置初始内容失败:', error);
        // 尝试使用其他方法
        try {
          // 检查是否有其他API可用
          if (typeof editor.execCommand === 'function') {
            editor.execCommand('mceSetContent', false, initialContent);
            calculateStats(initialContent);
          } else {
            console.error('没有可用的内容设置API');
          }
        } catch (fallbackError) {
          console.error('降级方法也失败:', fallbackError);
        }
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
  };

  // 添加初始化超时处理
  useEffect(() => {
    if (tinyMCEApiKey && !isEditorReady) {
      const timeout = setTimeout(() => {
        console.warn('TinyMCE编辑器初始化超时，可能是网络问题');
        // 即使初始化超时，也设置编辑器为就绪状态，让用户可以尝试使用
        setIsEditorReady(true);
      }, 10000); // 10秒超时

      return () => clearTimeout(timeout);
    }
  }, [tinyMCEApiKey, isEditorReady]);

  
  
  return (
    <div className="tinymce-editor-container">
      {/* 编辑器工具栏 */}
      <div className="editor-toolbar">
        <div className="editor-stats">
          <span className="word-count">字数: {wordCount}</span>
          <span className="reading-time">阅读时间: {readingTime}分钟</span>
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
              init={{
                ...TINYMCE_CONFIG,
                base_url: '/tinymce',
                suffix: '.min'
              }}
              onInit={handleEditorInit}
              onEditorChange={handleEditorChange}
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