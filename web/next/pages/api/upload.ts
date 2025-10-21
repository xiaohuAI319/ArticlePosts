import type { NextApiRequest, NextApiResponse } from 'next';
import cloudbase from '@cloudbase/node-sdk';

export const config = { api: { bodyParser: false } };

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const app = cloudbase.init({ env: process.env.TCB_ENV_ID });
    const storage = app.storage();
    const { default: Busboy } = await import('busboy');
    const bb = Busboy({ headers: req.headers as any });

    let fileUrl = '';
    await new Promise<void>((resolve, reject) => {
      bb.on('file', async (_name: string, file: NodeJS.ReadableStream, info: any) => {
        const filename = `${Date.now()}-${(info?.filename || 'upload')}`;
        const chunks: Buffer[] = [];
        (file as any).on('data', (d: Buffer) => chunks.push(d));
        (file as any).on('end', async () => {
          const buffer = Buffer.concat(chunks);
          const putRes = await storage.uploadFile({ cloudPath: `images/${filename}`, fileContent: buffer });
          const { fileList } = await storage.getTempFileURL({ fileList: [{ fileID: putRes.fileID, maxAge: 3600 * 24 * 7 }] });
          fileUrl = fileList[0].tempFileURL;
          resolve();
        });
      });
      bb.on('error', reject);
      (req as any).pipe(bb);
    });

    if (!fileUrl) return res.status(400).json({ error: 'no file' });
    res.status(200).json({ url: fileUrl });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'upload failed' });
  }
}
