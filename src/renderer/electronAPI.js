/**
 * 渲染进程API访问器
 * 通过contextBridge安全访问主进程API
 */

// 使用window.electronAPI访问主进程暴露的API
const electronAPI = window.electronAPI;

export default electronAPI;