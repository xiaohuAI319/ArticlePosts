import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Switch,
  message,
  Popconfirm,
  List,
  Descriptions,
  Badge,
  Progress,
  Alert
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';

function PlatformsPage() {
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [checkingAllStatus, setCheckingAllStatus] = useState(false);
  const [checkProgress, setCheckProgress] = useState(0);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [authModalVisible, setAuthModalVisible] = useState(false);
  const [currentPlatform, setCurrentPlatform] = useState(null);
  const [form] = Form.useForm();
  const [editForm] = Form.useForm();
  const dispatch = useDispatch();

  // 获取真实的electronAPI
  const electronAPI = window.electronAPI || {};

  // 加载平台列表
  const loadPlatforms = async () => {
    setLoading(true);
    try {
      // 传入false来显示所有平台，包括禁用的
      const result = await electronAPI.platforms.findAll(false);
      if (result.success) {
        setPlatforms(result.data);
      } else {
        message.error('加载平台列表失败');
      }
    } catch (error) {
      message.error('加载平台列表失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlatforms();
  }, []);

  // 检查所有平台状态
  const handleCheckAllStatus = async () => {
    setCheckingAllStatus(true);
    setCheckProgress(0);

    try {
      const totalSteps = platforms.length;
      for (let i = 0; i < totalSteps; i++) {
        setCheckProgress(Math.round(((i + 1) / totalSteps) * 100));
        await new Promise(resolve => setTimeout(resolve, 500)); // 模拟检查延迟
      }

      const result = await electronAPI.platforms.checkAllStatus();
      if (result.success) {
        const onlineCount = result.data.filter(r => r.success).length;
        const offlineCount = result.data.length - onlineCount;

        message.success(`状态检查完成：在线平台 ${onlineCount} 个，离线平台 ${offlineCount} 个`);
        await loadPlatforms(); // 重新加载平台列表
      }
    } catch (error) {
      message.error('状态检查失败');
    } finally {
      setCheckingAllStatus(false);
      setCheckProgress(0);
    }
  };

  // 添加平台
  const handleAddPlatform = async (values) => {
    try {
      const result = await electronAPI.platforms.create(values);
      if (result.success) {
        message.success('平台创建成功');
        setAddModalVisible(false);
        form.resetFields();
        await loadPlatforms();
      } else {
        message.error(result.message || '平台创建失败');
      }
    } catch (error) {
      message.error('平台创建失败');
    }
  };

  // 编辑平台
  const handleEditPlatform = (platform) => {
    setCurrentPlatform(platform);

    // 延迟设置表单值，确保DOM已经渲染
    setTimeout(() => {
      if (editForm && typeof editForm.setFieldsValue === 'function') {
        editForm.setFieldsValue({
          name: platform.name,
          display_name: platform.display_name,
          base_url: platform.base_url
        });
      }
    }, 100);
    setEditModalVisible(true);
  };

  const handleUpdatePlatform = async (values) => {
    try {
      const result = await electronAPI.platforms.update(currentPlatform.id, values);

      if (result.success) {
        message.success('平台配置更新成功');
        setEditModalVisible(false);
        editForm.resetFields();
        setCurrentPlatform(null);
        await loadPlatforms();
      } else {
        message.error(result.message || '平台更新失败');
      }
    } catch (error) {
      message.error('平台更新失败');
    }
  };

  // 删除平台
  const handleDeletePlatform = async (platform) => {
    try {
      const result = await electronAPI.platforms.delete(platform.id);
      if (result.success) {
        message.success('平台删除成功');
        await loadPlatforms();
      } else {
        message.error(result.message || '平台删除失败');
      }
    } catch (error) {
      message.error('平台删除失败');
    }
  };

  // 切换平台启用/禁用状态
  const handleTogglePlatformActive = async (platform) => {
    try {
      const newStatus = !platform.is_active;
      const result = await electronAPI.platforms.toggleActive(platform.id, newStatus);
      if (result.success) {
        message.success(result.message);
        await loadPlatforms();
      } else {
        message.error(result.message || '状态切换失败');
      }
    } catch (error) {
      message.error('状态切换失败');
    }
  };

  // 查看认证配置
  const handleViewAuthConfig = async (platform) => {
    try {
      const result = await electronAPI.platforms.getLoginConfig(platform.id);
      if (result.success) {
        setCurrentPlatform(result.data);
        setAuthModalVisible(true);
      } else {
        message.error('获取认证配置失败');
      }
    } catch (error) {
      message.error('获取认证配置失败');
    }
  };

  // 重试加载
  const handleRetry = () => {
    loadPlatforms();
  };

  const columns = [
    {
      title: '平台名称',
      dataIndex: 'display_name',
      key: 'display_name',
      render: (text, record) => (
        <Space>
          <span>{text}</span>
          {record.is_active ? (
            <Tag color="green">启用</Tag>
          ) : (
            <Tag color="red">禁用</Tag>
          )}
        </Space>
      )
    },
    {
      title: '基础URL',
      dataIndex: 'base_url',
      key: 'base_url',
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => {
        // 如果平台被禁用，直接显示离线状态
        if (!record.is_active) {
          return (
            <Badge
              status="error"
              text="已禁用"
            />
          );
        }

        // 如果平台启用，显示正常的在线/离线状态
        return (
          <Space direction="vertical" size="small">
            <Badge
              status={status === 'online' ? 'success' : 'error'}
              text={status === 'online' ? '网站可访问' : '网站不可访问'}
            />
            {record.response_time && (
              <span style={{ fontSize: '12px', color: '#666' }}>
                响应时间 {record.response_time}ms
              </span>
            )}
            {record.status_message && (
              <span style={{ fontSize: '12px', color: '#666' }}>
                {record.status_message}
              </span>
            )}
          </Space>
        );
      }
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditPlatform(record)}
          >
            编辑{record.display_name}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<SettingOutlined />}
            onClick={() => handleViewAuthConfig(record)}
          >
            查看认证配置
          </Button>
          <Button
            type="link"
            size="small"
            icon={record.is_active ? <ExclamationCircleOutlined /> : <CheckCircleOutlined />}
            style={{
              color: record.is_active ? '#ff4d4f' : '#52c41a'
            }}
            onClick={() => handleTogglePlatformActive(record)}
          >
            {record.is_active ? '禁用' : '启用'}
          </Button>
          <Popconfirm
            title={`确认删除${record.display_name}平台？`}
            description="删除后无法恢复，请谨慎操作。"
            onConfirm={() => handleDeletePlatform(record)}
            okText="确认删除"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除{record.display_name}
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  if (loading && platforms.length === 0) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">平台管理</h1>
          <p className="page-description">配置发布平台，管理登录状态和发布设置</p>
        </div>
        <div className="page-content">
          <Card>
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p>正在加载平台列表...</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (!loading && platforms.length === 0) {
    return (
      <div className="page-container">
        <div className="page-header">
          <h1 className="page-title">平台管理</h1>
          <p className="page-description">配置发布平台，管理登录状态和发布设置</p>
        </div>
        <div className="page-content">
          <Card>
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p>暂无平台配置</p>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setAddModalVisible(true)}
              >
                添加平台
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">平台管理</h1>
        <p className="page-description">配置发布平台，管理登录状态和发布设置</p>
      </div>

      <div className="page-content">
        <Card>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setAddModalVisible(true)}
              >
                添加平台
              </Button>
              <Button
                icon={<ReloadOutlined />}
                loading={checkingAllStatus}
                onClick={handleCheckAllStatus}
              >
                检查所有平台状态
              </Button>
            </Space>
          </div>

          {checkingAllStatus && (
            <Alert
              message="正在检查平台状态..."
              description={
                <Progress percent={checkProgress} size="small" />
              }
              type="info"
              style={{ marginBottom: 16 }}
            />
          )}

          <Table
            dataSource={platforms}
            columns={columns}
            rowKey="id"
            loading={loading}
            pagination={false}
          />
        </Card>
      </div>

      {/* 添加平台模态框 */}
      <Modal
        title="添加发布平台"
        open={addModalVisible}
        onCancel={() => {
          setAddModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddPlatform}
        >
          <Form.Item
            name="name"
            label="平台标识"
            rules={[{ required: true, message: '请输入平台标识' }]}
          >
            <Input placeholder="例如: zhihu" />
          </Form.Item>
          <Form.Item
            name="display_name"
            label="平台名称"
            rules={[{ required: true, message: '请输入平台名称' }]}
          >
            <Input placeholder="例如: 知乎" />
          </Form.Item>
          <Form.Item
            name="base_url"
            label="基础URL"
            rules={[{ required: true, message: '请输入基础URL' }]}
          >
            <Input placeholder="https://www.zhihu.com" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 编辑平台模态框 */}
      <Modal
        title="编辑平台配置"
        open={editModalVisible}
        onCancel={() => {
          setEditModalVisible(false);
          editForm.resetFields();
          setCurrentPlatform(null);
        }}
        onOk={() => editForm.submit()}
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={handleUpdatePlatform}
        >
          <Form.Item
            name="name"
            label="平台标识"
            rules={[{ required: true, message: '请输入平台标识' }]}
          >
            <Input placeholder="例如: zhihu" />
          </Form.Item>
          <Form.Item
            name="display_name"
            label="平台名称"
            rules={[{ required: true, message: '请输入平台名称' }]}
          >
            <Input placeholder="例如: 知乎" />
          </Form.Item>
          <Form.Item
            name="base_url"
            label="基础URL"
            rules={[{ required: true, message: '请输入基础URL' }]}
          >
            <Input placeholder="https://www.zhihu.com" />
          </Form.Item>
            </Form>
      </Modal>

      {/* 认证配置模态框 */}
      <Modal
        title="认证配置详情"
        open={authModalVisible}
        onCancel={() => {
          setAuthModalVisible(false);
          setCurrentPlatform(null);
        }}
        footer={[
          <Button key="close" onClick={() => setAuthModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        {currentPlatform && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="平台名称">
              {currentPlatform.platform?.display_name}
            </Descriptions.Item>
            <Descriptions.Item label="认证方式">
              二维码
            </Descriptions.Item>
            <Descriptions.Item label="登录URL">
              {currentPlatform.loginConfig?.loginUrl}
            </Descriptions.Item>
            <Descriptions.Item label="刷新间隔">
              {currentPlatform.loginConfig?.qrCodeConfig?.refreshInterval}ms
            </Descriptions.Item>
            <Descriptions.Item label="最大尝试次数">
              {currentPlatform.loginConfig?.qrCodeConfig?.maxAttempts}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}

export default PlatformsPage;