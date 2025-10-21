import { useRef, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const TinyEditor = dynamic(async () => {
  const module = await import('@tinymce/tinymce-react');
  return module.Editor;
}, { ssr: false });

export default function EditorPage() {
  const editorRef = useRef<any>(null);
  const [title, setTitle] = useState('');
  const [autoPublish, setAutoPublish] = useState(false);
  const tinymceApiKey = process.env.NEXT_PUBLIC_TINYMCE_API_KEY ?? '';

  useEffect(() => {
    // 可根据需要做登录/预设加载
  }, []);

  const handlePublish = () => {
    const html: string = editorRef.current?.getContent({ format: 'html' }) || '';
    if (!title.trim()) {
      alert('请先填写标题');
      return;
    }
    if (!html.trim()) {
      if (!confirm('正文为空，是否继续只发布标题？')) return;
    }

    const target = window.open('https://zhuanlan.zhihu.com/write', '_blank');
    if (!target) {
      alert('浏览器拦截了弹窗，请允许 localhost:3000 的弹窗后重试。');
      return;
    }
    const task = {
      type: 'ZILIU_TASK',
      platform: 'zhihu',
      autoPublish,
      payload: { title, content: html }
    } as const;

    const onMessage = (e: MessageEvent) => {
      const data: any = (e as any).data;
      if (!data || data.type !== 'ZILIU_TASK_RESULT') return;
      if (e.source !== target) return;
      window.removeEventListener('message', onMessage as any);
      const { status, url, error } = data;
      if (status === 'success') {
        alert('发布成功：' + (url || ''));
      } else {
        alert('发布失败：' + (error || '未知错误'));
      }
    };
    window.addEventListener('message', onMessage as any);

    // 支持 READY 握手 + 定时重试双轨制
    const onReady = (e: MessageEvent) => {
      const data: any = (e as any).data;
      if (!data || data.type !== 'ZILIU_READY' || data.platform !== 'zhihu') return;
      if (e.source !== target) return;
      try {
        window.removeEventListener('message', onReady as any);
      } catch {}
      try {
        target && target.postMessage(task, "https://zhuanlan.zhihu.com");
      } catch {}
    };
    window.addEventListener('message', onReady as any);

    const retries = [1000, 3000, 6000, 10000, 15000, 20000, 25000];
    retries.forEach((t) => setTimeout(() => { try { target && target.postMessage(task, "https://zhuanlan.zhihu.com"); } catch {} }, t));

    setTimeout(() => {
      try { window.removeEventListener('message', onMessage as any); } catch {}
      alert('未收到扩展响应。请确认：\n1) 已在 chrome://extensions 启用开发者模式并加载扩展\n2) 重试“ 一键发布到知乎 ”');
    }, 30000);
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 16 }}>
      <h2 style={{ margin: '8px 0 16px 0' }}>文章编辑 <span style={{ padding: '4px 8px', borderRadius: 999, background: '#f2f3f5', color: '#4e5969', fontSize: 12 }}>TinyMCE</span></h2>
      <input
        placeholder="请输入标题"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: '100%', fontSize: 18, padding: '10px 12px', border: '1px solid #e5e6eb', borderRadius: 8, outline: 'none', marginBottom: 12 }}
      />
      <TinyEditor
        onInit={(_, editor) => (editorRef.current = editor)}
        tinymceScriptSrc="https://cdn.jsdelivr.net/npm/tinymce@6/tinymce.min.js"
        init={{
          height: 960,
          min_height: 960,
          menubar: false,
          statusbar: false,
          branding: false,
          plugins: 'lists link image table code autoresize',
          toolbar: 'undo redo | blocks | bold italic underline | bullist numlist | link image table | code',
          autoresize_bottom_margin: 16,
          images_upload_handler: async (blobInfo) => {
            const form = new FormData();
            form.append('file', blobInfo.blob(), blobInfo.filename());
            const res = await fetch('/api/upload', { method: 'POST', body: form });
            if (!res.ok) throw new Error('上传失败');
            const data = await res.json();
            return data.url;
          },
          automatic_uploads: true,
          image_title: true,
          paste_data_images: true,
          convert_urls: false,
          content_style: 'body { line-height: 1.7; font-size: 16px; }'
        }}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
        <label>
          <input type="checkbox" checked={autoPublish} onChange={(e) => setAutoPublish(e.target.checked)} /> 自动发布（不勾选则只填充）
        </label>
        <button onClick={handlePublish} style={{ background: '#1677ff', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', cursor: 'pointer' }}>一键发布到知乎</button>
      </div>
    </div>
  );
}
