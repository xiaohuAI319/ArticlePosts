import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Table, Tag, message, Spin, Alert, Modal, QRCode, Progress, List } from 'antd';
import { PlayCircleOutlined, StopOutlined, ReloadOutlined, EyeOutlined, QrcodeOutlined } from '@ant-design/icons';

function LoginTestPage() {
  const [platforms, setPlatforms] = useState([]);
  const [activeLogins, setActiveLogins] = useState([]);
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [currentLogin, setCurrentLogin] = useState(null);
  const [loading, setLoading] = useState(false);
  const [qrModalVisible, setQrModalVisible] = useState(false);
  const [qrCodeData, setQrCodeData] = useState(null);
  const [loginProgress, setLoginProgress] = useState({});

  // 获取平台列表
  const fetchPlatforms = async () => {
    try {
      const result = await window.electronAPI.platforms.findAll(true);
      if (result.success) {
        setPlatforms(result.data || []);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('获取平台列表失败');
    }
  };

  // 获取活跃登录列表
  const fetchActiveLogins = async () => {
    try {
      const result = await window.electronAPI.autoLogin.getActiveLogins();
      if (result.success) {
        setActiveLogins(result.data || []);
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('获取活跃登录列表失败');
    }
  };

  // 监控登录状态
  const monitorLoginStatus = (loginId) => {
    const interval = setInterval(async () => {
      try {
        const result = await window.electronAPI.autoLogin.getStatus(loginId);
        if (result.success) {
          const loginData = result.data;

          // 更新当前登录状态
          setCurrentLogin(loginData);
          setLoginProgress(prev => ({
            ...prev,
            [loginId]: loginData
          }));

          // 检查是否需要显示二维码
          if (loginData.qrCodeData && loginData.qrCodeData.data) {
            setQrCodeData(loginData.qrCodeData);
            setQrModalVisible(true);
          }

          // 登录成功或失败时停止监控
          if (['success', 'failed', 'cancelled'].includes(loginData.status)) {
            clearInterval(interval);

            if (loginData.status === 'success') {
              message.success(`${loginData.platformName} 登录成功！`);
              setQrModalVisible(false);
            } else if (loginData.status === 'failed') {
              message.error(`${loginData.platformName} 登录失败：${loginData.error}`);
              setQrModalVisible(false);
            } else if (loginData.status === 'cancelled') {
              message.info(`${loginData.platformName} 登录已取消`);
              setQrModalVisible(false);
            }

            // 刷新列表
            fetchActiveLogins();
          }
        }
      } catch (error) {
        console.error('获取登录状态失败:', error);
      }
    }, 2000); // 每2秒检查一次

    // 设置清理函数
    return () => clearInterval(interval);
  };

  // 启动登录
  const startLogin = async (platform) => {
    setLoading(true);
    setSelectedPlatform(platform);
    setCurrentLogin(null);
    setQrCodeData(null);

    try {
      const result = await window.electronAPI.autoLogin.start(platform.id, {
        headless: false,
        timeout: 180000 // 3分钟超时
      });

      if (result.success) {
        const loginId = result.data.loginId;
        setCurrentLogin(result.data);

        message.success(`开始登录 ${platform.display_name}`);

        // 开始监控登录状态
        const cleanup = monitorLoginStatus(loginId);

        // 设置清理函数到组件状态
        setCurrentLogin(prev => ({
          ...prev,
          cleanup
        }));

        // 刷新活跃登录列表
        fetchActiveLogins();
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('启动登录失败');
    } finally {
      setLoading(false);
    }
  };

  // 取消登录
  const cancelLogin = async (loginId) => {
    try {
      const result = await window.electronAPI.autoLogin.cancel(loginId);
      if (result.success) {
        message.success('登录已取消');
        fetchActiveLogins();

        if (currentLogin && currentLogin.id === loginId) {
          setCurrentLogin(null);
          setQrModalVisible(false);
        }
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('取消登录失败');
    }
  };

  // 查看登录详情
  const viewLoginDetails = async (loginId) => {
    try {
      const result = await window.electronAPI.autoLogin.getStatus(loginId);
      if (result.success) {
        setCurrentLogin(result.data);

        if (result.data.qrCodeData && result.data.qrCodeData.data) {
          setQrCodeData(result.data.qrCodeData);
          setQrModalVisible(true);
        }
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('获取登录详情失败');
    }
  };

  // 刷新数据
  const refreshData = async () => {
    await Promise.all([
      fetchPlatforms(),
      fetchActiveLogins()
    ]);
  };

  useEffect(() => {
    refreshData();

    return () => {
      // 清理登录监控
      if (currentLogin && currentLogin.cleanup) {
        currentLogin.cleanup();
      }
    };
  }, []);

  // 平台表格列定义
  const platformColumns = [
    {
      title: '平台名称',
      dataIndex: 'display_name',
      key: 'display_name',
      render: (text, record) => (
        <Space>
          <span>{text}</span>
          {record.is_active ? <Tag color="green">启用</Tag> : <Tag color="red">禁用</Tag>}
        </Space>
      )
    },
    {
      title: '登录方式',
      dataIndex: ['config_schema', 'auth_method'],
      key: 'auth_method',
      render: (method) => {
        const methodMap = {
          'qr_code': '扫码登录',
          'password': '密码登录',
          'oauth': 'OAuth登录'
        };
        return methodMap[method] || method;
      }
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={() => startLogin(record)}
            loading={loading && selectedPlatform?.id === record.id}
            disabled={!record.is_active}
          >
            开始登录
          </Button>
        </Space>
      )
    }
  ];

  // 活跃登录表格列定义
  const activeLoginColumns = [
    {
      title: '登录ID',
      dataIndex: 'id',
      key: 'id',
      width: 200,
      render: (text) => <code>{text.substring(0, 20)}...</code>
    },
    {
      title: '平台',
      dataIndex: 'platformName',
      key: 'platformName'
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusConfig = {
          'starting': { color: 'blue', text: '启动中' },
          'browser_created': { color: 'blue', text: '浏览器已创建' },
          'navigating_to_login': { color: 'blue', text: '访问登录页' },
          'waiting_qrcode': { color: 'orange', text: '等待扫码' },
          'qrcode_ready': { color: 'green', text: '二维码就绪' },
          'success': { color: 'green', text: '登录成功' },
          'failed': { color: 'red', text: '登录失败' },
          'cancelled': { color: 'gray', text: '已取消' }
        };

        const config = statusConfig[status] || { color: 'default', text: status };
        return <Tag color={config.color}>{config.text}</Tag>;
      }
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (time) => new Date(time).toLocaleString()
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => viewLoginDetails(record.id)}
          >
            详情
          </Button>
          {!['success', 'failed', 'cancelled'].includes(record.status) && (
            <Button
              type="link"
              danger
              icon={<StopOutlined />}
              onClick={() => cancelLogin(record.id)}
            >
              取消
            </Button>
          )}
        </Space>
      )
    }
  ];

  // 计算登录进度百分比
  const getLoginProgress = (loginData) => {
    if (!loginData) return 0;

    const statusOrder = [
      'starting', 'browser_created', 'navigating_to_login',
      'waiting_qrcode', 'qrcode_ready', 'success'
    ];

    const currentIndex = statusOrder.indexOf(loginData.status);
    return currentIndex >= 0 ? ((currentIndex + 1) / statusOrder.length) * 100 : 0;
  };

  return (
    <div style={{ padding: '20px' }}>
      <Card title="T015 平台自动化登录测试" style={{ marginBottom: '20px' }}>
        <Alert
          message="测试说明"
          description="此页面用于测试T015平台自动化登录功能。选择平台后点击'开始登录'，系统将自动打开浏览器并处理登录流程。支持扫码登录和密码登录等多种方式。"
          type="info"
          showIcon
          style={{ marginBottom: '20px' }}
        />

        <Space style={{ marginBottom: '20px' }}>
          <Button
            icon={<ReloadOutlined />}
            onClick={refreshData}
          >
            刷新
          </Button>
        </Space>

        {/* 当前登录状态 */}
        {currentLogin && (
          <Card
            title={`当前登录：${currentLogin.platformName}`}
            style={{ marginBottom: '20px' }}
            size="small"
          >
            <Space direction="vertical" style={{ width: '100%' }}>
              <div>
                <strong>状态：</strong>
                <Tag color="blue">{currentLogin.status}</Tag>
              </div>

              <div>
                <strong>进度：</strong>
                <Progress
                  percent={Math.round(getLoginProgress(currentLogin))}
                  size="small"
                  status={currentLogin.status === 'failed' ? 'exception' : 'active'}
                />
              </div>

              {currentLogin.error && (
                <div>
                  <strong>错误：</strong>
                  <span style={{ color: 'red' }}>{currentLogin.error}</span>
                </div>
              )}

              {currentLogin.sessionId && (
                <div>
                  <strong>会话ID：</strong>
                  <code>{currentLogin.sessionId}</code>
                </div>
              )}
            </Space>
          </Card>
        )}

        <h4>可用平台</h4>
        <Table
          dataSource={platforms}
          columns={platformColumns}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{
            emptyText: '暂无可用平台'
          }}
        />
      </Card>

      <Card title="活跃登录流程" style={{ marginBottom: '20px' }}>
        <Table
          dataSource={activeLogins}
          columns={activeLoginColumns}
          rowKey="id"
          pagination={false}
          size="small"
          locale={{
            emptyText: '暂无活跃登录流程'
          }}
        />
      </Card>

      {/* 二维码模态框 */}
      <Modal
        title="扫码登录"
        open={qrModalVisible}
        onCancel={() => setQrModalVisible(false)}
        footer={[
          <Button key="refresh" icon={<ReloadOutlined />}>
            刷新二维码
          </Button>,
          <Button key="close" onClick={() => setQrModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={400}
      >
        {qrCodeData && qrCodeData.data && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ marginBottom: '16px' }}>
              <p>请使用手机App扫描下方二维码登录</p>
            </div>

            {qrCodeData.data.startsWith('data:image') ? (
              <img
                src={qrCodeData.data}
                alt="登录二维码"
                style={{ width: '200px', height: '200px' }}
              />
            ) : (
              <QRCode
                value={qrCodeData.data || 'loading...'}
                size={200}
              />
            )}

            <div style={{ marginTop: '16px' }}>
              <p style={{ fontSize: '12px', color: '#666' }}>
                平台：{qrCodeData.platform} |
                生成时间：{new Date(qrCodeData.timestamp).toLocaleString()}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default LoginTestPage;