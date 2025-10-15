import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Table, Tag, message, Spin, Alert } from 'antd';
import { PlayCircleOutlined, StopOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';

function BrowserTestPage() {
  const [browsers, setBrowsers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [stealthConfig, setStealthConfig] = useState({});

  // 获取浏览器列表
  const fetchBrowsers = async () => {
    try {
      const result = await window.electronAPI.browser.getAll();
      if (result.success) {
        setBrowsers(result.data || []);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('获取浏览器列表失败');
    }
  };

  // 获取统计信息
  const fetchStats = async () => {
    try {
      const result = await window.electronAPI.browser.getStats();
      if (result.success) {
        setStats(result.data || {});
      }
    } catch (error) {
      message.error('获取统计信息失败');
    }
  };

  // 获取隐身配置
  const fetchStealthConfig = async () => {
    try {
      const result = await window.electronAPI.browser.getStealthConfig();
      if (result.success) {
        setStealthConfig(result.data || {});
      }
    } catch (error) {
      message.error('获取隐身配置失败');
    }
  };

  // 创建浏览器
  const createBrowser = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.browser.create({
        headless: false,
        stealth: true
      });

      if (result.success) {
        message.success(`浏览器创建成功 [${result.data.browserId}]`);
        await fetchBrowsers();
        await fetchStats();
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('创建浏览器失败');
    } finally {
      setLoading(false);
    }
  };

  // 关闭浏览器
  const closeBrowser = async (browserId) => {
    try {
      const result = await window.electronAPI.browser.close(browserId);
      if (result.success) {
        message.success(`浏览器关闭成功 [${browserId}]`);
        await fetchBrowsers();
        await fetchStats();
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('关闭浏览器失败');
    }
  };

  // 清理所有浏览器
  const cleanupAll = async () => {
    try {
      const result = await window.electronAPI.browser.cleanup();
      if (result.success) {
        message.success('所有浏览器清理完成');
        await fetchBrowsers();
        await fetchStats();
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('清理浏览器失败');
    }
  };

  // 刷新数据
  const refreshData = async () => {
    await Promise.all([
      fetchBrowsers(),
      fetchStats(),
      fetchStealthConfig()
    ]);
  };

  useEffect(() => {
    refreshData();
  }, []);

  // 表格列定义
  const columns = [
    {
      title: '浏览器ID',
      dataIndex: 'id',
      key: 'id',
      width: 200,
      render: (text) => <code>{text}</code>
    },
    {
      title: '连接状态',
      dataIndex: 'connected',
      key: 'connected',
      width: 100,
      render: (connected) => (
        <Tag color={connected ? 'green' : 'red'}>
          {connected ? '已连接' : '已断开'}
        </Tag>
      )
    },
    {
      title: '进程ID',
      dataIndex: ['metadata', 'processId'],
      key: 'processId',
      width: 100,
      render: (pid) => pid ? <code>{pid}</code> : '-'
    },
    {
      title: '创建时间',
      dataIndex: ['metadata', 'createdAt'],
      key: 'createdAt',
      width: 150,
      render: (date) => new Date(date).toLocaleString()
    },
    {
      title: '最后活动',
      dataIndex: ['metadata', 'lastActivity'],
      key: 'lastActivity',
      width: 150,
      render: (date) => new Date(date).toLocaleString()
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Button
          type="link"
          danger
          size="small"
          icon={<StopOutlined />}
          onClick={() => closeBrowser(record.id)}
        >
          关闭
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: '20px' }}>
      <Card title="T014 浏览器管理测试" style={{ marginBottom: '20px' }}>
        <Alert
          message="测试说明"
          description="此页面用于测试T014 Puppeteer浏览器集成功能。点击创建浏览器按钮将启动一个真实的Chrome浏览器实例。"
          type="info"
          showIcon
          style={{ marginBottom: '20px' }}
        />

        <Space style={{ marginBottom: '20px' }}>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={createBrowser}
            loading={loading}
          >
            创建浏览器
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={refreshData}
          >
            刷新
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={cleanupAll}
          >
            清理所有浏览器
          </Button>
        </Space>

        <div style={{ marginBottom: '20px' }}>
          <h4>统计信息</h4>
          <Space>
            <Tag color="blue">总计创建: {stats.totalCreated || 0}</Tag>
            <Tag color="green">活跃数量: {stats.activeBrowsers || 0}</Tag>
            <Tag color="orange">总计关闭: {stats.totalClosed || 0}</Tag>
            {stats.health && (
              <Tag color={stats.health.healthy ? 'green' : 'red'}>
                健康状态: {stats.health.healthy ? '正常' : '异常'}
              </Tag>
            )}
          </Space>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4>隐身配置示例</h4>
          <pre style={{
            background: '#f5f5f5',
            padding: '10px',
            borderRadius: '4px',
            fontSize: '12px',
            maxHeight: '200px',
            overflow: 'auto'
          }}>
            {JSON.stringify(stealthConfig, null, 2)}
          </pre>
        </div>

        <h4>浏览器实例列表</h4>
        <Table
          dataSource={browsers}
          columns={columns}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{
            emptyText: '暂无浏览器实例'
          }}
        />
      </Card>
    </div>
  );
}

export default BrowserTestPage;