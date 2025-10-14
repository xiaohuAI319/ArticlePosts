import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';
import { combineReducers } from '@reduxjs/toolkit';

// 导入各个切片
import appSlice from './slices/appSlice';
import articleSlice from './slices/articleSlice';
import platformSlice from './slices/platformSlice';

// 持久化配置
const persistConfig = {
  key: 'root',
  storage,
  whitelist: ['app', 'platforms'], // 只持久化应用状态和平台配置
};

// 合并所有reducer
const rootReducer = combineReducers({
  app: appSlice,
  articles: articleSlice,
  platforms: platformSlice,
});

// 创建持久化reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// 配置store
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
  devTools: process.env.NODE_ENV !== 'production',
});

// 创建persistor
export const persistor = persistStore(store);

// 导出类型定义（用于TypeScript，暂时注释掉）
// export type RootState = ReturnType<typeof store.getState>;
// export type AppDispatch = typeof store.dispatch;