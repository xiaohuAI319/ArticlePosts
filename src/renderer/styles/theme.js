/**
 * 应用主题系统 - T004基础UI布局框架
 * 提供完整的设计token和Ant Design主题配置
 */

// 基础颜色系统
export const colors = {
  // 主色调
  primary: {
    50: '#f0f9ff',
    100: '#e0f2fe',
    200: '#bae6fd',
    300: '#7dd3fc',
    400: '#38bdf8',
    500: '#0ea5e9', // 主色
    600: '#0284c7',
    700: '#0369a1',
    800: '#075985',
    900: '#0c4a6e',
  },

  // 辅助色
  secondary: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b', // 辅助色
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
  },

  // 成功色
  success: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e', // 成功色
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },

  // 警告色
  warning: {
    50: '#fffbeb',
    100: '#fef3c7',
    200: '#fde68a',
    300: '#fcd34d',
    400: '#fbbf24',
    500: '#f59e0b', // 警告色
    600: '#d97706',
    700: '#b45309',
    800: '#92400e',
    900: '#78350f',
  },

  // 错误色
  error: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444', // 错误色
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },

  // 中性色
  neutral: {
    50: '#fafafa',
    100: '#f4f4f5',
    200: '#e4e4e7',
    300: '#d4d4d8',
    400: '#a1a1aa',
    500: '#71717a',
    600: '#52525b',
    700: '#3f3f46',
    800: '#27272a',
    900: '#18181b',
  }
};

// 字体系统
export const typography = {
  // 字体族
  fontFamily: {
    sans: ['Inter', 'system-ui', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', '"Helvetica Neue"', 'Arial', '"Noto Sans"', 'sans-serif'],
    serif: ['Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
    mono: ['"SF Mono"', 'Monaco', 'Inconsolata', '"Roboto Mono"', '"Source Code Pro"', 'monospace'],
    chinese: ['"PingFang SC"', '"Hiragino Sans GB"', '"Microsoft YaHei"', '"微软雅黑"', 'SimSun', 'sans-serif']
  },

  // 字体大小
  fontSize: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '36px',
    '5xl': '48px',
    '6xl': '60px',
    '7xl': '72px',
    '8xl': '96px',
    '9xl': '128px'
  },

  // 字体粗细
  fontWeight: {
    thin: 100,
    extralight: 200,
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
    black: 900
  },

  // 行高
  lineHeight: {
    none: 1,
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  }
};

// 间距系统
export const spacing = {
  0: '0px',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  11: '44px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
  28: '112px',
  32: '128px',
  36: '144px',
  40: '160px',
  44: '176px',
  48: '192px',
  52: '208px',
  56: '224px',
  60: '240px',
  64: '256px',
  72: '288px',
  80: '320px',
  96: '384px'
};

// 断点系统
export const breakpoints = {
  xs: '480px',
  sm: '576px',
  md: '768px',
  lg: '992px',
  xl: '1200px',
  xxl: '1600px',
  xxxl: '1920px'
};

// 阴影系统
export const shadows = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
  base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
  xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
  inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
  none: 'none'
};

// 边框半径系统
export const borderRadius = {
  none: '0px',
  sm: '2px',
  base: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  '3xl': '24px',
  full: '9999px'
};

// 过渡动画系统
export const transitions = {
  duration: {
    75: '75ms',
    100: '100ms',
    150: '150ms',
    200: '200ms',
    300: '300ms',
    500: '500ms',
    700: '700ms',
    1000: '1000ms'
  },

  timingFunction: {
    linear: 'linear',
    ease: 'ease',
    easeIn: 'ease-in',
    easeOut: 'ease-out',
    easeInOut: 'ease-in-out',
  },

  property: {
    common: 'background-color, border-color, color, fill, stroke, opacity, box-shadow, transform',
    colors: 'background-color, border-color, color, fill, stroke',
    opacity: 'opacity',
    shadow: 'box-shadow',
    transform: 'transform'
  }
};

// Ant Design主题配置
export const antdTheme = {
  token: {
    // 主色彩
    colorPrimary: colors.primary[500],
    colorSuccess: colors.success[500],
    colorWarning: colors.warning[500],
    colorError: colors.error[500],
    colorInfo: colors.primary[500],

    // 中性色
    colorTextBase: colors.neutral[900],
    colorTextSecondary: colors.neutral[600],
    colorTextTertiary: colors.neutral[400],
    colorTextQuaternary: colors.neutral[300],

    colorBgBase: '#ffffff',
    colorBgContainer: '#ffffff',
    colorBgElevated: '#ffffff',
    colorBgLayout: colors.neutral[50],

    colorBorder: colors.neutral[200],
    colorBorderSecondary: colors.neutral[100],

    // 字体
    fontFamily: typography.fontFamily.chinese.join(', '),
    fontSize: 14,
    fontSizeHeading1: parseInt(typography.fontSize['4xl']),
    fontSizeHeading2: parseInt(typography.fontSize['3xl']),
    fontSizeHeading3: parseInt(typography.fontSize['2xl']),
    fontSizeHeading4: parseInt(typography.fontSize.xl),
    fontSizeHeading5: parseInt(typography.fontSize.lg),

    // 圆角
    borderRadius: 6,
    borderRadiusLG: 8,
    borderRadiusSM: 4,

    // 阴影
    boxShadow: shadows.base,
    boxShadowSecondary: shadows.sm,

    // 控制台高度
    controlHeight: 32,
    controlHeightSM: 24,
    controlHeightLG: 40,

    // 动画
    motionDurationFast: transitions.duration[150],
    motionDurationMid: transitions.duration[300],
    motionDurationSlow: transitions.duration[500],
  },

  components: {
    Layout: {
      headerBg: colors.primary[600],
      headerHeight: 64,
      siderBg: colors.neutral[50],
      bodyBg: colors.neutral[50],
    },

    Menu: {
      itemBg: 'transparent',
      itemSelectedBg: colors.primary[50],
      itemSelectedColor: colors.primary[600],
      itemHoverBg: colors.neutral[100],
      itemActiveBg: colors.primary[100],
    },

    Button: {
      controlHeight: 36,
      controlHeightSM: 28,
      controlHeightLG: 44,
      paddingInline: 16,
      paddingInlineSM: 12,
      paddingInlineLG: 20,

      primaryShadow: shadows.sm,
      defaultShadow: 'none',

      borderRadius: 6,
    },

    Input: {
      controlHeight: 36,
      controlHeightSM: 28,
      controlHeightLG: 44,
      paddingInline: 12,

      borderRadius: 6,
      activeBorderColor: colors.primary[400],
      hoverBorderColor: colors.primary[300],
    },

    Card: {
      borderRadius: 8,
      paddingLG: 24,
      padding: 20,
      paddingSM: 16,

      boxShadow: shadows.sm,
      boxShadowTertiary: shadows.none,
    },

    Modal: {
      borderRadius: 8,
      paddingLG: 24,

      contentBg: colors.neutral[50],
      headerBg: colors.neutral[50],
    },

    Table: {
      borderRadius: 6,
      headerBg: colors.neutral[50],
      headerColor: colors.neutral[900],

      borderColor: colors.neutral[200],
      colorBgContainer: '#ffffff',
    },

    Form: {
      labelColor: colors.neutral[700],
      requiredMarkColor: colors.error[500],

      itemMarginBottom: 24,
      verticalLabelPadding: '0 0 8px',
    },

    Select: {
      controlHeight: 36,
      controlHeightSM: 28,
      controlHeightLG: 44,

      borderRadius: 6,
      optionSelectedBg: colors.primary[50],
    },

    DatePicker: {
      controlHeight: 36,
      controlHeightSM: 28,
      controlHeightLG: 44,

      borderRadius: 6,
    },

    Alert: {
      borderRadius: 6,
      padding: 16,

      successBg: colors.success[50],
      successColor: colors.success[700],
      warningBg: colors.warning[50],
      warningColor: colors.warning[700],
      errorBg: colors.error[50],
      errorColor: colors.error[700],
      infoBg: colors.primary[50],
      infoColor: colors.primary[700],
    },

    Progress: {
      borderRadius: 4,

      successColor: colors.success[500],
      exceptionColor: colors.error[500],
    },

    Badge: {
      borderRadius: 10,
      colorSuccess: colors.success[500],
      colorError: colors.error[500],
      colorWarning: colors.warning[500],
    },

    Switch: {
      borderRadius: 12,

      colorPrimary: colors.primary[500],
      colorPrimaryHover: colors.primary[400],
    },

    Checkbox: {
      borderRadius: 4,

      colorPrimary: colors.primary[500],
      colorPrimaryHover: colors.primary[400],
    },

    Radio: {
      borderRadius: 16,

      colorPrimary: colors.primary[500],
      colorPrimaryHover: colors.primary[400],
    },

    Rate: {
      starColor: colors.warning[400],
      starBg: colors.neutral[200],
    },

    Slider: {
      borderRadius: 4,

      trackBg: colors.neutral[200],
      trackHoverBg: colors.neutral[300],
      colorPrimary: colors.primary[500],
      colorPrimaryBorderHover: colors.primary[400],
    },

    Upload: {
      borderRadius: 6,

      colorPrimary: colors.primary[500],
      colorPrimaryHover: colors.primary[400],
    },
  }
};

// 暗色主题配置
export const darkTheme = {
  ...antdTheme,
  algorithm: 'darkAlgorithm',
  token: {
    ...antdTheme.token,
    colorPrimary: colors.primary[400],
    colorSuccess: colors.success[400],
    colorWarning: colors.warning[400],
    colorError: colors.error[400],

    colorTextBase: colors.neutral[100],
    colorTextSecondary: colors.neutral[400],
    colorTextTertiary: colors.neutral[500],
    colorTextQuaternary: colors.neutral[600],

    colorBgBase: colors.neutral[900],
    colorBgContainer: colors.neutral[800],
    colorBgElevated: colors.neutral[800],
    colorBgLayout: colors.neutral[900],

    colorBorder: colors.neutral[700],
    colorBorderSecondary: colors.neutral[600],
  }
};

// 导出默认主题
export default antdTheme;

// 主题切换工具函数
export const createTheme = (isDark = false) => {
  return isDark ? darkTheme : antdTheme;
};

// 获取主题色的工具函数
export const getThemeColor = (colorPath, isDark = false) => {
  const theme = createTheme(isDark);
  const paths = colorPath.split('.');
  let color = theme;

  for (const path of paths) {
    color = color[path];
    if (!color) return null;
  }

  return color;
};

// CSS变量生成工具
export const generateCSSVariables = (theme = antdTheme) => {
  const cssVars = {};

  // 生成颜色变量
  Object.entries(colors).forEach(([colorName, colorValues]) => {
    Object.entries(colorValues).forEach(([shade, value]) => {
      cssVars[`--color-${colorName}-${shade}`] = value;
    });
  });

  // 生成字体变量
  Object.entries(typography.fontSize).forEach(([key, value]) => {
    cssVars[`--font-size-${key}`] = value;
  });

  // 生成间距变量
  Object.entries(spacing).forEach(([key, value]) => {
    cssVars[`--spacing-${key}`] = value;
  });

  // 生成阴影变量
  Object.entries(shadows).forEach(([key, value]) => {
    cssVars[`--shadow-${key}`] = value;
  });

  return cssVars;
};