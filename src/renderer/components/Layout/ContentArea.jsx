import React from 'react';
import { useSelector } from 'react-redux';
import EditorPage from '../Pages/EditorPage';
import PublishPage from '../Pages/PublishPage';
import PlatformsPage from '../Pages/PlatformsPage';
import ArticlesPage from '../Pages/ArticlesPage';
import HistoryPage from '../Pages/HistoryPage';
import SettingsPage from '../Pages/SettingsPage';
import BrowserTestPage from '../Pages/BrowserTestPage';
import './ContentArea.css';

function ContentArea() {
  const { currentPage } = useSelector(state => state.app);

  const renderCurrentPage = () => {
    switch (currentPage) {
    case 'editor':
      return <EditorPage />;
    case 'publish':
      return <PublishPage />;
    case 'platforms':
      return <PlatformsPage />;
    case 'articles':
      return <ArticlesPage />;
    case 'history':
      return <HistoryPage />;
    case 'settings':
      return <SettingsPage />;
    case 'browser-test':
      return <BrowserTestPage />;
    default:
      return <EditorPage />;
    }
  };

  return (
    <div className="content-area">
      {renderCurrentPage()}
    </div>
  );
}

export default ContentArea;