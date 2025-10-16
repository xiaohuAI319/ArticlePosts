import React, { useState, useEffect } from 'react';
import { Card, Button, Space, Table, Tag, message, Spin, Alert, Modal, QRCode, Progress, List, Tooltip } from 'antd';
import { PlayCircleOutlined, StopOutlined, ReloadOutlined, EyeOutlined, QrcodeOutlined, CloseCircleOutlined } from '@ant-design/icons';

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

  // 退出登录会话
  const handleLogoutSession = async (loginRecord) => {
    try {
      if (!loginRecord.sessionId) {
        message.error('没有关联的会话ID');
        return;
      }

      const result = await window.electronAPI.autoLogin.deactivateSession(loginRecord.sessionId);
      if (result.success) {
        message.success(`${loginRecord.platformName} 已退出登录`);
        fetchActiveLogins();
      } else {
        message.error(result.message);
      }
    } catch (error) {
      message.error('退出登录失败');
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
      render: (status, record) => {
        const statusConfig = {
          'starting': { color: 'blue', text: '启动中' },
          'browser_created': { color: 'blue', text: '浏览器已创建' },
          'navigating_to_login': { color: 'blue', text: '访问登录页' },
          'waiting_qrcode': { color: 'orange', text: '等待扫码' },
          'qrcode_ready': { color: 'green', text: '二维码就绪' },
          'success': { color: 'green', text: record.isRestored ? '已登录（恢复）' : '登录成功' },
          'failed': { color: 'red', text: '登录失败' },
          'cancelled': { color: 'gray', text: '已取消' }
        };

        const config = statusConfig[status] || { color: 'default', text: status };
        return (
          <Space>
            <Tag color={config.color}>{config.text}</Tag>
            {record.isRestored && <Tag color="purple">会话恢复</Tag>}
          </Space>
        );
      }
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (time) => new Date(time).toLocaleString()
    },
    {
      title: '会话ID',
      dataIndex: 'sessionId',
      key: 'sessionId',
      render: (sessionId) => sessionId ? (
        <Tooltip title="持久化会话ID">
          <code>{String(sessionId).substring(0, 12)}...</code>
        </Tooltip>
      ) : '-'
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
          {record.isRestored && (
            <Button
              type="link"
              danger
              onClick={() => handleLogoutSession(record)}
            >
              退出登录
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
            {/* 重要提示 */}
            <div style={{
              margin: '0 0 16px 0',
              padding: '12px',
              backgroundColor: '#e6f7ff',
              border: '1px solid #91d5ff',
              borderRadius: '6px'
            }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#1890ff' }}>
                📱 重要提示
              </p>
              <p style={{ margin: '0', fontSize: '14px', color: '#333' }}>
                请<strong>优先扫描Chrome浏览器中的二维码</strong>，这个是最清晰的原始二维码
              </p>
            </div>

            {/* 二维码显示区域 */}
            {qrCodeData.type === 'qrcode_status' ? (
              <div style={{
                padding: '20px',
                border: '1px solid #d9d9d9',
                borderRadius: '8px',
                backgroundColor: '#f6ffed',
                textAlign: 'center'
              }}>
                <QrcodeOutlined style={{ fontSize: '48px', color: '#52c41a', marginBottom: '16px' }} />
                <p style={{ margin: 0, color: '#52c41a', fontSize: '16px', fontWeight: 'bold' }}>
                  ✅ 二维码已就绪
                </p>
                <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#666' }}>
                  请查看Chrome浏览器窗口进行扫码登录
                </p>
              </div>
            ) : qrCodeData.type === 'qrcode_error' ? (
              <div style={{
                padding: '20px',
                border: '1px solid #d9d9d9',
                borderRadius: '8px',
                backgroundColor: '#fff2f0',
                textAlign: 'center'
              }}>
                <CloseCircleOutlined style={{ fontSize: '48px', color: '#ff4d4f', marginBottom: '16px' }} />
                <p style={{ margin: 0, color: '#ff4d4f', fontSize: '16px', fontWeight: 'bold' }}>
                  ⚠️ 二维码获取失败
                </p>
                <p style={{ margin: '8px 0 0 0', fontSize: '14px', color: '#666' }}>
                  请查看Chrome浏览器窗口中的二维码
                </p>
              </div>
            ) : qrCodeData.data && qrCodeData.data.startsWith('data:image') ? (
              <div>
                <div style={{ marginBottom: '12px' }}>
                  <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
                    📷 应用内二维码（备用）
                  </p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#999' }}>
                    如果无法扫描，请使用Chrome浏览器中的二维码
                  </p>
                </div>
                <img
                  src={qrCodeData.data}
                  alt="登录二维码"
                  style={{
                    width: '200px',
                    height: '200px',
                    maxWidth: '100%',
                    border: '1px solid #d9d9d9',
                    borderRadius: '8px',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                  }}
                  onError={(e) => {
                    console.error('二维码图片加载失败:', e);
                    message.error('二维码图片加载失败');
                  }}
                />
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '12px' }}>
                  <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>
                    📷 应用内二维码（备用）
                  </p>
                </div>
                <QRCode
                  value={qrCodeData.data && qrCodeData.data.length > 2000 ?
                    (qrCodeData.data.substring(0, 2000) + '...') :
                    (qrCodeData.data || 'loading...')}
                  size={200}
                  errorLevel="M"
                  onError={() => {
                    console.error('二维码生成失败，数据长度:', qrCodeData.data?.length);
                    message.error('二维码数据过长，无法显示');
                  }}
                />
              </div>
            )}

            {/* 操作说明 */}
            <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#fafafa', borderRadius: '6px' }}>
              <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 'bold' }}>
                🔗 扫码步骤：
              </p>
              <ol style={{ margin: '0', paddingLeft: '20px', textAlign: 'left', fontSize: '13px', color: '#666' }}>
                <li>打开知乎手机App</li>
                <li>点击首页右上角的"+"号</li>
                <li>选择"扫一扫"</li>
                <li><strong>优先扫描Chrome浏览器中的二维码</strong></li>
                <li>在手机上确认登录</li>
              </ol>
            </div>

            {/* 状态信息 */}
            <div style={{ marginTop: '12px' }}>
              <p style={{ fontSize: '12px', color: '#999' }}>
                平台：{qrCodeData.platform} |
                生成时间：{new Date(qrCodeData.timestamp).toLocaleString()}
                {qrCodeData.dataSize && ` | 数据大小：${Math.round(qrCodeData.dataSize/1024)}KB`}
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default LoginTestPage;