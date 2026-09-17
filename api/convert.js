const { Resvg } = require('@resvg/resvg-js');
const sharp     = require('sharp');
const path      = require('path');
const fs        = require('fs');

const getFontBase64 = (name) => {
  try {
    const fullPath = path.join(process.cwd(), 'api', 'fonts', name);
    return fs.readFileSync(fullPath).toString('base64');
  } catch (err) { return null; }
};

const fontRegular   = getFontBase64('LINESeedSansTH_Rg.ttf');
const fontBold      = getFontBase64('LINESeedSansTH_Bd.ttf');
const fontExtraBold = getFontBase64('LINESeedSansTH_XBd.ttf');
const fontAppBold   = getFontBase64('LINESeedSansTH_A_XBd.ttf');

const buildFontStyle = () => {
  const faces = [];
  if (fontRegular) {
    faces.push("@font-face { font-family: 'LINESeedSansTH-Regular'; src: url('data:font/truetype;base64," + fontRegular + "') format('truetype'); }");
    faces.push("@font-face { font-family: 'LINE Seed Sans TH'; font-weight: 400; src: url('data:font/truetype;base64," + fontRegular + "') format('truetype'); }");
  }
  if (fontBold) {
    faces.push("@font-face { font-family: 'LINESeedSansTH-Bold'; src: url('data:font/truetype;base64," + fontBold + "') format('truetype'); }");
    faces.push("@font-face { font-family: 'LINE Seed Sans TH'; font-weight: 700; src: url('data:font/truetype;base64," + fontBold + "') format('truetype'); }");
  }
  if (fontExtraBold) {
    faces.push("@font-face { font-family: 'LINESeedSansTH-ExtraBold'; src: url('data:font/truetype;base64," + fontExtraBold + "') format('truetype'); }");
    faces.push("@font-face { font-family: 'LINE Seed Sans TH'; font-weight: 800; src: url('data:font/truetype;base64," + fontExtraBold + "') format('truetype'); }");
  }
  if (fontAppBold) {
    faces.push("@font-face { font-family: 'LINESeedSansTH-A-ExtraBold'; src: url('data:font/truetype;base64," + fontAppBold + "') format('truetype'); }");
  }
  return '<style>' + faces.join('\n') + '</style>';
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { svg, fitTo, bgBase64 } = req.body;

    if (!svg) {
      return res.status(400).json({ error: 'No SVG data provided' });
    }

    // Inject fonts
    const fontStyle = buildFontStyle();
    const hasDefs   = svg.includes('<defs>');
    let svgWithFonts;
    if (hasDefs) {
      svgWithFonts = svg.replace('<defs>', '<defs>' + fontStyle);
    } else {
      svgWithFonts = svg.replace(/<svg([^>]*)>/, '<svg$1><defs>' + fontStyle + '</defs>');
    }

    // Render SVG → PNG (transparent background when bgBase64 provided)
    const resvgOptions = {
      fitTo: fitTo || { mode: 'width', value: 2000 },
      font: {
        fontFiles: [
          path.join(process.cwd(), 'api', 'fonts', 'LINESeedSansTH_Rg.ttf'),
          path.join(process.cwd(), 'api', 'fonts', 'LINESeedSansTH_Bd.ttf'),
          path.join(process.cwd(), 'api', 'fonts', 'LINESeedSansTH_XBd.ttf'),
          path.join(process.cwd(), 'api', 'fonts', 'LINESeedSansTH_A_XBd.ttf'),
        ],
        loadSystemFonts: false,
        defaultFontFamily: 'LINESeedSansTH-Regular',
      },
    };

    // Only set white background when no bg image (otherwise keep transparent)
    if (!bgBase64) {
      resvgOptions.background = 'white';
    }

    const resvg     = new Resvg(svgWithFonts, resvgOptions);
    const pngBuffer = resvg.render().asPng();

    // If background provided → composite text layer on top of bg image
    if (bgBase64) {
      const bgBuffer   = Buffer.from(bgBase64, 'base64');
      const pngMeta    = await sharp(pngBuffer).metadata();
      const width      = pngMeta.width;
      const height     = pngMeta.height;

      const composited = await sharp(bgBuffer)
        .resize(width, height)
        .composite([{ input: pngBuffer, blend: 'over' }])
        .png()
        .toBuffer();

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate');
      return res.status(200).send(composited);
    }

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 's-maxage=1, stale-while-revalidate');
    return res.status(200).send(pngBuffer);

  } catch (e) {
    console.error('Render Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
