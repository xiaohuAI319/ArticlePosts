/**
 * 网页版发布API
 * 用于替代electronAPI，与Chrome扩展通信
 */

class WebPublishAPI {
  constructor() {
    this.isWebVersion = !window.electronAPI;
    this.taskIdCounter = 0;
    this.activeTasks = new Map();
    this.messageListeners = new Map();
  }

  // 检查是否为网页版
  isWeb() {
    return this.isWebVersion;
  }

  // 生成任务ID
  generateTaskId() {
    return `web_task_${Date.now()}_${++this.taskIdCounter}`;
  }

  // 与Chrome扩展通信
  async sendMessageToExtension(task) {
    return new Promise((resolve, reject) => {
      if (!this.isWebVersion) {
        // 桌面版使用electronAPI
        reject(new Error('桌面版不应使用WebPublishAPI'));
        return;
      }

      const taskId = task.taskId || this.generateTaskId();

      // 设置消息监听器
      const timeout = setTimeout(() => {
        this.messageListeners.delete(taskId);
        reject(new Error('发布超时，请检查Chrome扩展是否正常工作'));
      }, 60000); // 60秒超时

      this.messageListeners.set(taskId, { resolve, reject, timeout });

      // 发送消息到Chrome扩展
      console.log('[WebPublishAPI] 发送任务到Chrome扩展:', task);
      window.postMessage({
        type: 'ZILIU_PUBLISH_TASK',
        taskId,
        ...task
      }, '*');
    });
  }

  // 监听来自扩展的消息
  setupMessageListener() {
    if (!this.isWebVersion) return;

    const handleMessage = (event) => {
      if (event.data?.type === 'ZILIU_TASK_RESULT') {
        const { taskId, status, error, url } = event.data;
        const listener = this.messageListeners.get(taskId);

        if (listener) {
          clearTimeout(listener.timeout);
          this.messageListeners.delete(taskId);

          if (status === 'success') {
            console.log('[WebPublishAPI] 任务成功:', taskId);
            listener.resolve({ success: true, data: { taskId, url } });
          } else {
            console.error('[WebPublishAPI] 任务失败:', taskId, error);
            listener.reject(new Error(error || '发布失败'));
          }
        }
      }
    };

    window.addEventListener('message', handleMessage);
    console.log('[WebPublishAPI] 消息监听器已设置');
  }

  // 发布文章（网页版）
  async publish(articleId, platformIds) {
    if (!this.isWebVersion) {
      throw new Error('桌面版不应使用WebPublishAPI.publish');
    }

    console.log('[WebPublishAPI] 开始网页版发布:', { articleId, platformIds });

    try {
      // 获取文章数据
      const response = await fetch(`/api/articles/${articleId}`);
      if (!response.ok) {
        throw new Error('获取文章失败');
      }
      const article = await response.json();

      if (!article.success || !article.data) {
        throw new Error('文章数据无效');
      }

      const articleData = article.data;
      console.log('[WebPublishAPI] 文章数据获取成功:', articleData.title);

      // 构建发布任务
      const publishTask = {
        articleId,
        title: articleData.title,
        content: articleData.content || articleData.html_content,
        platforms: platformIds,
        autoPublish: platformIds.includes('zhihu') // 知乎平台自动发布
      };

      // 发送到Chrome扩展
      const result = await this.sendMessageToExtension(publishTask);
      console.log('[WebPublishAPI] 发布任务完成:', result);

      return result;
    } catch (error) {
      console.error('[WebPublishAPI] 发布失败:', error);
      throw error;
    }
  }

  // 兼容性方法：获取发布状态
  async getPublishStatus(articleId) {
    if (!this.isWebVersion) {
      throw new Error('桌面版不应使用WebPublishAPI.getPublishStatus');
    }

    // 网页版简化处理
    return { success: true, data: { status: 'completed' } };
  }

  // 兼容性方法：取消发布
  async cancelPublish(articleId, platformId) {
    if (!this.isWebVersion) {
      throw new Error('桌面版不应使用WebPublishAPI.cancelPublish');
    }

    // 网页版简化处理
    return { success: true };
  }
}

// 创建单例实例
const webPublishAPI = new WebPublishAPI();

// 自动设置消息监听器
if (webPublishAPI.isWeb()) {
  webPublishAPI.setupMessageListener();
}

export default webPublishAPI;