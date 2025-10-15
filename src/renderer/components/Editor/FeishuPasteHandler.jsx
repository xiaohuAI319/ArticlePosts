/**
 * 飞书格式粘贴处理器 - T008飞书格式支持
 * 处理从飞书文档复制的格式化内容，转换为TinyMCE兼容格式
 */

import React, { useEffect, useRef } from 'react';
import { message } from 'antd';
import { useDispatch } from 'react-redux';
import { updateEditorContent } from '../../store/slices/articleSlice';

class FeishuPasteProcessor {
  constructor() {
    this.isFeishuContent = false;
    this.imageQueue = [];
  }

  /**
   * 检测是否为飞书文档内容
   */
  detectFeishuContent(htmlContent) {
    // 飞书文档的特征标识
    const feishuIndicators = [
      'data-feishu-',
      'feishu-',
      'lark-',
      'bytedance',
      // 飞书特有的class名
      'feishu-block',
      'feishu-text',
      'feishu-image',
      'feishu-table',
      // 飞书文档的meta标签
      '<meta name="generator" content="feishu"',
      'feishu.cn',
      'larksuite.com'
    ];

    return feishuIndicators.some(indicator =>
      htmlContent.toLowerCase().includes(indicator)
    );
  }

  /**
   * 转换飞书格式为TinyMCE兼容格式
   */
  convertFeishuToTinyMCE(htmlContent) {
    let convertedContent = htmlContent;

    // 1. 转换标题格式
    convertedContent = this.convertHeadings(convertedContent);

    // 2. 转换段落格式
    convertedContent = this.convertParagraphs(convertedContent);

    // 3. 转换列表格式
    convertedContent = this.convertLists(convertedContent);

    // 4. 转换图片格式
    convertedContent = this.convertImages(convertedContent);

    // 5. 转换表格格式
    convertedContent = this.convertTables(convertedContent);

    // 6. 转换代码块格式
    convertedContent = this.convertCodeBlocks(convertedContent);

    // 7. 转换引用格式
    convertedContent = this.convertQuotes(convertedContent);

    // 8. 清理飞书特有的属性和标签
    convertedContent = this.cleanupFeishuAttributes(convertedContent);

    return convertedContent;
  }

  /**
   * 转换标题格式
   */
  convertHeadings(content) {
    // 飞书标题可能使用div + class的方式
    const headingRules = [
      { pattern: /<div[^>]*class="[^"]*feishu-heading-1[^"]*"[^>]*>(.*?)<\/div>/gi, replacement: '<h1>$1</h1>' },
      { pattern: /<div[^>]*class="[^"]*feishu-heading-2[^"]*"[^>]*>(.*?)<\/div>/gi, replacement: '<h2>$1</h2>' },
      { pattern: /<div[^>]*class="[^"]*feishu-heading-3[^"]*"[^>]*>(.*?)<\/div>/gi, replacement: '<h3>$1</h3>' },
      { pattern: /<div[^>]*class="[^"]*feishu-heading-4[^"]*"[^>]*>(.*?)<\/div>/gi, replacement: '<h4>$1</h4>' },
      { pattern: /<div[^>]*class="[^"]*feishu-heading-5[^"]*"[^>]*>(.*?)<\/div>/gi, replacement: '<h5>$1</h5>' },
      { pattern: /<div[^>]*class="[^"]*feishu-heading-6[^"]*"[^>]*>(.*?)<\/div>/gi, replacement: '<h6>$1</h6>' },
      // 也可能是data-level属性
      { pattern: /<div[^>]*data-level="1"[^>]*>(.*?)<\/div>/gi, replacement: '<h1>$1</h1>' },
      { pattern: /<div[^>]*data-level="2"[^>]*>(.*?)<\/div>/gi, replacement: '<h2>$1</h2>' },
      { pattern: /<div[^>]*data-level="3"[^>]*>(.*?)<\/div>/gi, replacement: '<h3>$1</h3>' },
      { pattern: /<div[^>]*data-level="4"[^>]*>(.*?)<\/div>/gi, replacement: '<h4>$1</h4>' },
      { pattern: /<div[^>]*data-level="5"[^>]*>(.*?)<\/div>/gi, replacement: '<h5>$1</h5>' },
      { pattern: /<div[^>]*data-level="6"[^>]*>(.*?)<\/div>/gi, replacement: '<h6>$1</h6>' }
    ];

    headingRules.forEach(rule => {
      content = content.replace(rule.pattern, rule.replacement);
    });

    return content;
  }

  /**
   * 转换段落格式
   */
  convertParagraphs(content) {
    // 飞书段落可能使用div + class的方式
    const paragraphPattern = /<div[^>]*class="[^"]*feishu-paragraph[^"]*"[^>]*>(.*?)<\/div>/gi;
    content = content.replace(paragraphPattern, '<p>$1</p>');

    // 处理普通div转换为段落
    const divPattern = /<div[^>]*class="[^"]*feishu-text[^"]*"[^>]*>(.*?)<\/div>/gi;
    content = content.replace(divPattern, '<p>$1</p>');

    return content;
  }

  /**
   * 转换列表格式
   */
  convertLists(content) {
    // 转换无序列表
    const unorderedListPattern = /<div[^>]*class="[^"]*feishu-list-unordered[^"]*"[^>]*>(.*?)<\/div>/gi;
    content = content.replace(unorderedListPattern, '<ul><li>$1</li></ul>');

    // 转换有序列表
    const orderedListPattern = /<div[^>]*class="[^"]*feishu-list-ordered[^"]*"[^>]*>(.*?)<\/div>/gi;
    content = content.replace(orderedListPattern, '<ol><li>$1</li></ol>');

    // 处理列表项
    const listItemPattern = /<div[^>]*class="[^"]*feishu-list-item[^"]*"[^>]*>(.*?)<\/div>/gi;
    content = content.replace(listItemPattern, '<li>$1</li>');

    return content;
  }

  /**
   * 转换图片格式
   */
  convertImages(content) {
    // 处理飞书图片
    const imagePattern = /<img[^>]*data-src="([^"]*)"[^>]*data-feishu[^>]*>/gi;
    content = content.replace(imagePattern, (match, src) => {
      // 将data-src转换为src
      return match.replace(/data-src="/g, 'src="');
    });

    // 处理飞书的图片容器
    const imageContainerPattern = /<div[^>]*class="[^"]*feishu-image[^"]*"[^>]*>(.*?)<\/div>/gi;
    content = content.replace(imageContainerPattern, '$1');

    return content;
  }

  /**
   * 转换表格格式
   */
  convertTables(content) {
    // 处理飞书表格容器
    const tableContainerPattern = /<div[^>]*class="[^"]*feishu-table[^"]*"[^>]*>(.*?)<\/div>/gi;
    content = content.replace(tableContainerPattern, '<table>$1</table>');

    // 处理表格行
    const tableRowPattern = /<div[^>]*class="[^"]*feishu-table-row[^"]*"[^>]*>(.*?)<\/div>/gi;
    content = content.replace(tableRowPattern, '<tr>$1</tr>');

    // 处理表格单元格
    const tableCellPattern = /<div[^>]*class="[^"]*feishu-table-cell[^"]*"[^>]*>(.*?)<\/div>/gi;
    content = content.replace(tableCellPattern, '<td>$1</td>');

    return content;
  }

  /**
   * 转换代码块格式
   */
  convertCodeBlocks(content) {
    // 处理飞书代码块 - 使用保守的匹配模式
    const codeBlockPatterns = [
      // 模式1: 标准的飞书代码块容器
      {
        pattern: /<div[^>]*class="[^"]*feishu-code-block[^"]*"[^>]*>(.*?)<\/div>/gis,
        replacement: '<pre><code>$1</code></pre>'
      },
      // 模式2: 带语言标识的代码块
      {
        pattern: /<div[^>]*class="[^"]*feishu-code[^"]*"[^>]*data-language="([^"]*)"[^>]*>(.*?)<\/div>/gis,
        replacement: (match, language, code) => {
          return `<pre><code class="language-${language || 'text'}">${code}</code></pre>`;
        }
      },
      // 模式3: 飞书代码块的主要识别模式
      {
        pattern: /<div[^>]*class="[^"]*code-block[^"]*"[^>]*>(.*?)<\/div>/gis,
        replacement: '<pre><code>$1</code></pre>'
      }
    ];

    // 应用所有代码块转换规则
    codeBlockPatterns.forEach(rule => {
      content = content.replace(rule.pattern, rule.replacement);
    });

    // 处理内联代码 - 精确匹配
    const inlineCodePatterns = [
      // 标准内联代码
      {
        pattern: /<span[^>]*class="[^"]*feishu-inline-code[^"]*"[^>]*>(.*?)<\/span>/gis,
        replacement: '<code>$1</code>'
      }
    ];

    // 应用所有内联代码转换规则
    inlineCodePatterns.forEach(rule => {
      content = content.replace(rule.pattern, rule.replacement);
    });

    // 后处理：清理代码块内容
    content = content.replace(/<pre><code>(.*?)<\/code><\/pre>/gis, (match, code) => {
      // 清理代码内容，保留必要的换行和空格
      let cleanCode = code
        .replace(/&nbsp;/g, ' ')  // 替换HTML空格实体
        .replace(/&lt;/g, '<')    // 恢复小于号
        .replace(/&gt;/g, '>')    // 恢复大于号
        .replace(/&amp;/g, '&')    // 恢复和号
        .replace(/&quot;/g, '"')  // 恢复引号
        .replace(/&#39;/g, "'")   // 恢复单引号
        .replace(/<br\s*\/?>/gi, '\n')  // 将HTML换行转换为实际换行
        .replace(/<\/p>\s*<p>/gi, '\n')  // 将段落分隔转换为换行
        .replace(/<div[^>]*>/gi, '\n')   // 将div标签转换为换行
        .replace(/<\/div>/gi, '\n')     // 将div结束标签转换为换行
        .replace(/<span[^>]*>/gi, '')   // 移除span开始标签
        .replace(/<\/span>/gi, '')      // 移除span结束标签
        .replace(/<[^>]*>/g, '')        // 移除剩余的HTML标签
        .trim();

      // 恢复代码的缩进格式
      cleanCode = cleanCode
        .split('\n')
        .map(line => {
          // 保留行首的空格（缩进）
          const leadingSpaces = line.match(/^ */)[0];
          const content = line.trim();
          return content ? leadingSpaces + content : '';
        })
        .join('\n');

      return `<pre><code>${cleanCode}</code></pre>`;
    });

    return content;
  }

  /**
   * 转换引用格式
   */
  convertQuotes(content) {
    // 处理飞书引用块
    const quotePattern = /<div[^>]*class="[^"]*feishu-quote[^"]*"[^>]*>(.*?)<\/div>/gi;
    content = content.replace(quotePattern, '<blockquote>$1</blockquote>');

    return content;
  }

  /**
   * 清理飞书特有的属性和标签
   */
  cleanupFeishuAttributes(content) {
    // 移除飞书特有的data属性
    content = content.replace(/\s*data-feishu-[^=]*="[^"]*"/gi, '');
    content = content.replace(/\s*data-lark-[^=]*="[^"]*"/gi, '');
    content = content.replace(/\s*data-bytedance-[^=]*="[^"]*"/gi, '');

    // 移除飞书特有的class
    content = content.replace(/\s*class="[^"]*feishu-[^"]*"/gi, '');
    content = content.replace(/\s*class="[^"]*lark-[^"]*"/gi, '');

    // 移除空的标签
    content = content.replace(/<[^>]*>\s*<\/[^>]*>/g, '');

    // 清理多余空格
    content = content.replace(/\s+/g, ' ');

    return content;
  }

  /**
   * 处理图片下载和本地存储
   */
  async handleImageDownload(imageUrl) {
    try {
      // 这里需要与主进程通信来下载图片
      // 暂时返回原始URL，后续实现图片下载功能
      return imageUrl;
    } catch (error) {
      console.error('图片下载失败:', error);
      return imageUrl;
    }
  }

  /**
   * 处理粘贴事件
   */
  async handlePaste(event, tinymceEditor) {
    const clipboardData = event.clipboardData || window.clipboardData;
    if (!clipboardData) return false;

    // 获取HTML内容
    const htmlContent = clipboardData.getData('text/html');
    const plainText = clipboardData.getData('text/plain');

    // 检测是否为飞书内容
    const isFeishu = htmlContent && this.detectFeishuContent(htmlContent);

    if (isFeishu) {
      event.preventDefault();

      try {
        // 转换飞书格式
        const convertedContent = this.convertFeishuToTinyMCE(htmlContent);

        // 插入转换后的内容到编辑器
        tinymceEditor.insertContent(convertedContent);

        message.success('飞书格式已转换并保持');
        return true;
      } catch (error) {
        message.error('格式转换失败，已插入纯文本');

        // 降级处理：插入纯文本
        if (plainText) {
          tinymceEditor.insertContent(`<p>${plainText}</p>`);
        }
        return false;
      }
    }

    return false; // 不是飞书内容，使用默认处理
  }
}

// React组件
function FeishuPasteHandler({ editor }) {
  const dispatch = useDispatch();
  const handlerRef = useRef(null);
  const [isHandlerReady, setIsHandlerReady] = React.useState(false);

  useEffect(() => {
    if (!editor) {
      return;
    }

    // 简化的编辑器API检测 - 不再依赖editor.on方法
    // TinyMCE的粘贴事件已经通过编辑器配置处理，这里只需要初始化处理器
    handlerRef.current = new FeishuPasteProcessor();
    setIsHandlerReady(true);

    // 清理函数
    return () => {
      handlerRef.current = null;
    };
  }, [editor]);

  return null; // 这个组件不需要渲染任何UI
}

export default FeishuPasteHandler;