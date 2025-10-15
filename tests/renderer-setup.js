import '@testing-library/jest-dom';

// Mock electronAPI for renderer tests
global.electronAPI = {
  platforms: {
    findAll: jest.fn(),
    getAvailable: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    checkStatus: jest.fn(),
    checkAllStatus: jest.fn(),
    getLoginConfig: jest.fn(),
    getPublishConfig: jest.fn()
  }
};

// Mock window object for electron APIs
Object.defineProperty(window, 'electronAPI', {
  value: global.electronAPI,
  writable: true
});