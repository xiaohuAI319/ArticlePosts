/**
 * 二维码登录组件 - T013
 * 用于显示平台登录二维码，支持定时刷新和状态反馈
 */

import React, { useState, useEffect, useRef } from 'react';
import { Button, Card, Typography, Progress, Spin, message, Modal } from 'antd';
import { QrcodeOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { useSelector, useDispatch } from 'react-redux';
import { updateLoginStatus } from '../../store/slices/authSlice';

const { Title, Text } = Typography;

const QRCodeLogin = ({
  platformId,
  platformName,
  loginUrl,
  onLoginSuccess,
  onLoginError,
  visible = true,
  onCancel
}) => {
  const dispatch = useDispatch();
  const { loginStatus } = useSelector(state => state.auth);

  const [qrCodeData, setQrCodeData] = useState('');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [countdown, setCountdown] = useState(0);

  const countdownInterval = useRef(null);
  const progressInterval = useRef(null);
  const statusCheckInterval = useRef(null);

  // 二维码有效期（秒）
  const QR_CODE_EXPIRY = 120; // 2分钟
  const REFRESH_INTERVAL = 10; // 10秒检查一次状态

  useEffect(() => {
    if (visible && platformId && loginUrl) {
      generateQRCode();
    }

    return () => {
      cleanup();
    };
  }, [visible, platformId, loginUrl]);

  // 清理定时器
  const cleanup = () => {
    if (countdownInterval.current) {
      clearInterval(countdownInterval.current);
      countdownInterval.current = null;
    }
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }
    if (statusCheckInterval.current) {
      clearInterval(statusCheckInterval.current);
      statusCheckInterval.current = null;
    }
  };

  // 生成二维码
  const generateQRCode = async () => {
    try {
      setLoading(true);
      setRefreshing(true);

      // 生成唯一的会话ID
      const sessionId = `qr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // 构建完整的登录URL（包含会话ID）
      const fullLoginUrl = `${loginUrl}?session_id=${sessionId}&platform=${platformName}&timestamp=${Date.now()}`;

      // 调用后端API生成二维码
      const result = await electronAPI.qrCode.generate(fullLoginUrl, {
        platformId,
        sessionId,
        platformName,
        expiresAt: new Date(Date.now() + QR_CODE_EXPIRY * 1000).toISOString()
      });

      if (result.success) {
        setQrCodeData(result.data.qrCode);
        startCountdown();
        startStatusCheck(sessionId);
        dispatch(updateLoginStatus({
          platformId,
          status: 'waiting',
          message: '请使用手机App扫描二维码登录'
        }));
      } else {
        throw new Error(result.message || '生成二维码失败');
      }
    } catch (error) {
      console.error('生成二维码失败:', error);
      message.error('生成二维码失败，请重试');
      if (onLoginError) {
        onLoginError(error);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
      setProgress(0);
    }
  };

  // 开始倒计时
  const startCountdown = () => {
    setCountdown(QR_CODE_EXPIRY);
    setProgress(100);

    countdownInterval.current = setInterval(() => {
      setCountdown(prev => {
        const newCountdown = prev - 1;

        if (newCountdown <= 0) {
          clearInterval(countdownInterval.current);
          countdownInterval.current = null;
          setProgress(0);

          // 二维码过期，自动刷新
          setTimeout(() => {
            refreshQRCode();
          }, 1000);

          return 0;
        }

        // 更新进度条
        setProgress(Math.round((newCountdown / QR_CODE_EXPIRY) * 100));
        return newCountdown;
      });
    }, 1000);
  };

  // 开始状态检查
  const startStatusCheck = (sessionId) => {
    statusCheckInterval.current = setInterval(async () => {
      try {
        const result = await electronAPI.qrCode.checkStatus(sessionId);

        if (result.success) {
          const { status, data } = result.data;

          if (status === 'scanned') {
            // 已扫描，等待确认
            dispatch(updateLoginStatus({
              platformId,
              status: 'scanned',
              message: '二维码已扫描，请在手机上确认登录'
            }));
          } else if (status === 'confirmed') {
            // 已确认，登录成功
            handleLoginSuccess(data);
          } else if (status === 'expired') {
            // 二维码过期
            refreshQRCode();
          } else if (status === 'failed') {
            // 登录失败
            handleLoginError(new Error(data?.message || '登录失败'));
          }
        }
      } catch (error) {
        console.error('检查登录状态失败:', error);
      }
    }, REFRESH_INTERVAL * 1000);
  };

  // 刷新二维码
  const refreshQRCode = () => {
    cleanup();
    generateQRCode();
  };

  // 处理登录成功
  const handleLoginSuccess = (loginData) => {
    cleanup();

    dispatch(updateLoginStatus({
      platformId,
      status: 'success',
      message: '登录成功'
    }));

    message.success(`${platformName} 登录成功！`);

    if (onLoginSuccess) {
      onLoginSuccess(loginData);
    }

    // 延迟关闭模态框
    setTimeout(() => {
      if (onCancel) {
        onCancel();
      }
    }, 2000);
  };

  // 处理登录错误
  const handleLoginError = (error) => {
    cleanup();

    dispatch(updateLoginStatus({
      platformId,
      status: 'error',
      message: error.message || '登录失败'
    }));

    message.error(`登录失败: ${error.message}`);

    if (onLoginError) {
      onLoginError(error);
    }
  };

  // 格式化倒计时显示
  const formatCountdown = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // 获取状态图标
  const getStatusIcon = () => {
    switch (loginStatus[platformId]?.status) {
      case 'waiting':
        return <QrcodeOutlined style={{ fontSize: 48, color: '#1890ff' }} />;
      case 'scanned':
        return <QrcodeOutlined style={{ fontSize: 48, color: '#faad14' }} />;
      case 'success':
        return <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />;
      case 'error':
        return <CloseCircleOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />;
      default:
        return <QrcodeOutlined style={{ fontSize: 48, color: '#1890ff' }} />;
    }
  };

  // 获取状态文本
  const getStatusText = () => {
    return loginStatus[platformId]?.message || '正在生成二维码...';
  };

  // 获取状态颜色
  const getStatusColor = () => {
    switch (loginStatus[platformId]?.status) {
      case 'waiting':
        return '#1890ff';
      case 'scanned':
        return '#faad14';
      case 'success':
        return '#52c41a';
      case 'error':
        return '#ff4d4f';
      default:
        return '#1890ff';
    }
  };

  return (
    <Modal
      title={`${platformName} 扫码登录`}
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="refresh"
          icon={<ReloadOutlined />}
          onClick={refreshQRCode}
          loading={loading || refreshing}
          disabled={loading}
        >
          刷新二维码
        </Button>,
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>
      ]}
      width={400}
      centered
    >
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        {/* 状态图标 */}
        <div style={{ marginBottom: '16px' }}>
          {loading ? (
            <Spin size="large" />
          ) : (
            getStatusIcon()
          )}
        </div>

        {/* 状态文本 */}
        <div style={{ marginBottom: '16px' }}>
          <Text style={{ color: getStatusColor(), fontSize: '16px' }}>
            {getStatusText()}
          </Text>
        </div>

        {/* 二维码显示 */}
        {qrCodeData && (
          <div style={{
            display: 'inline-block',
            padding: '16px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            border: '1px solid #d9d9d9'
          }}>
            <img
              src={qrCodeData}
              alt={`${platformName} 登录二维码`}
              style={{
                width: '200px',
                height: '200px',
                display: 'block'
              }}
            />
          </div>
        )}

        {/* 倒计时和进度条 */}
        {countdown > 0 && (
          <div style={{ marginTop: '16px' }}>
            <div style={{ marginBottom: '8px' }}>
              <Text type="secondary">
                二维码有效期：{formatCountdown(countdown)}
              </Text>
            </div>
            <Progress
              percent={progress}
              showInfo={false}
              strokeColor={getStatusColor()}
              size="small"
            />
          </div>
        )}

        {/* 提示信息 */}
        <div style={{ marginTop: '16px' }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            1. 打开{platformName}手机应用<br/>
            2. 扫描上方二维码<br/>
            3. 在手机上确认登录
          </Text>
        </div>
      </div>
    </Modal>
  );
};

export default QRCodeLogin;