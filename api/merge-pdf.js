import { PDFDocument } from 'pdf-lib';

export const config = {
  api: { bodyParser: { sizeLimit: '50mb' } }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { images } = req.body;
    const pdfDoc = await PDFDocument.create();
    for (const b64 of images) {
      const pngBytes = Buffer.from(b64, 'base64');
      const pngImage = await pdfDoc.embedPng(pngBytes);
      const { width, height } = pngImage.scale(1);
      const page = pdfDoc.addPage([width, height]);
      page.drawImage(pngImage, { x: 0, y: 0, width, height });
    }
    const pdfBytes = await pdfDoc.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.send(Buffer.from(pdfBytes));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
