import React, { useState, useEffect } from 'react';
import { Card, List, Switch, Button, message, Typography } from 'antd';
import electronAPI from '../../electronAPI';

const { Text } = Typography;

/**
 * 平台状态控制面板
 * 实现了 guifan.md 中定义的核心流程第一步
 */
function PlatformStatusPanel() {
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 组件加载时，从主进程获取所有平台的初始状态
    const fetchPlatformStatuses = async () => {
      try {
        setLoading(true);
        const platformList = await electronAPI.getPlatformStatuses();
        setPlatforms(platformList);
      } catch (error) {
        message.error(`加载平台列表失败: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchPlatformStatuses();

    // 监听主进程发来的状态更新通知
    const handlePlatformStatusChange = (event, { name, loggedIn }) => {
      setPlatforms(prevPlatforms =>
        prevPlatforms.map(p =>
          p.name === name ? { ...p, isLoggedIn: loggedIn } : p
        )
      );
      message.success(`${name} 登录状态已更新!`);
    };

    electronAPI.onPlatformStatusChanged(handlePlatformStatusChange);

    // 组件卸载时，移除监听器
    return () => {
      electronAPI.removePlatformStatusChangedListener(handlePlatformStatusChange);
    };
  }, []);

  // 处理启用/禁用平台的切换
  const handleEnableToggle = async (platformName, checked) => {
    try {
      await electronAPI.setPlatformEnabled({ name: platformName, isEnabled: checked });
      setPlatforms(prevPlatforms =>
        prevPlatforms.map(p =>
          p.name === platformName ? { ...p, is_active: checked } : p
        )
      );
      message.success(`${platformName} 已${checked ? '启用' : '禁用'}`);
    } catch (error) {
      message.error(`更新平台状态失败: ${error.message}`);
    }
  };

  // 处理点击“未登录”按钮
  const handleLoginClick = async (platformName) => {
    try {
      message.info(`正在拉起 ${platformName} 的登录窗口...`);
      await electronAPI.requestPlatformLogin(platformName);
      // 登录成功后的状态更新由主进程的 onPlatformStatusChanged 事件处理
    } catch (error) {
      message.error(`登录 ${platformName} 失败: ${error.message}`);
    }
  };

  return (
    <Card title="发布平台" style={{ width: 300, marginLeft: 16 }}>
      <List
        loading={loading}
        itemLayout="horizontal"
        dataSource={platforms}
        renderItem={item => (
          <List.Item
            actions={[
              <Switch
                checked={item.is_active}
                onChange={(checked) => handleEnableToggle(item.name, checked)}
                size="small"
              />
            ]}
          >
            <List.Item.Meta
              title={<Text>{item.display_name}</Text>}
              description={
                item.isLoggedIn ? (
                  <Text type="success">已登录</Text>
                ) : (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => handleLoginClick(item.name)}
                    style={{ padding: 0 }}
                  >
                    未登录
                  </Button>
                )
              }
            />
          </List.Item>
        )}
      />
    </Card>
  );
}

export default PlatformStatusPanel;