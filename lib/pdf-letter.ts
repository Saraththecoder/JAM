import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, degrees, rgb } from 'pdf-lib';
import QRCode from 'qrcode';

export interface LetterPdfData {
  id: string;
  created_at: string;
  generated_body: string;
  status: string;
  mentor_id: string | null;
  hod_id: string | null;
  mentor_signed_at: string | null;
  hod_signed_at: string | null;
  letter_types: { name: string } | null;
  student: {
    full_name: string;
    roll_number: string;
    departments: { name: string } | null;
  } | null;
  mentor: {
    full_name: string;
    designation: string | null;
    esign_storage_path: string | null;
  } | null;
  hod: {
    full_name: string;
    designation: string | null;
    esign_storage_path: string | null;
  } | null;
}

interface GenerateOptions {
  origin: string;
  mentorSignature?: ArrayBuffer | null;
  hodSignature?: ArrayBuffer | null;
}

const PAGE_WIDTH = 595.27;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const BODY_FONT_SIZE = 11;
const LINE_SPACING = 18;

function sanitizeForStandardFont(text: string): string {
  return text
    .replaceAll('\u2018', "'")
    .replaceAll('\u2019', "'")
    .replaceAll('\u201c', '"')
    .replaceAll('\u201d', '"')
    .replaceAll('\u2013', '-')
    .replaceAll('\u2014', '-')
    .replaceAll('\u2022', '-')
    .replace(/[^\x00-\xFF]/g, '?');
}

function wrapText(
  text: string,
  maxWidth: number,
  font: PDFFont,
  fontSize: number
): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      lines.push('');
      continue;
    }

    const words = paragraph.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);

      if (width <= maxWidth) {
        currentLine = testLine;
        continue;
      }

      if (currentLine) {
        lines.push(currentLine);
        currentLine = '';
      }

      // Break a single word that is wider than the content area.
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) {
        let chunk = '';
        for (const char of word) {
          const testChunk = chunk + char;
          if (font.widthOfTextAtSize(testChunk, fontSize) > maxWidth && chunk) {
            lines.push(chunk);
            chunk = char;
          } else {
            chunk = testChunk;
          }
        }
        currentLine = chunk;
      } else {
        currentLine = word;
      }
    }

    if (currentLine) lines.push(currentLine);
  }

  return lines;
}

function formatDateIST(dateInput: string | Date): string {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(safeDate);
}

function referenceNumberFor(letter: LetterPdfData): string {
  const department =
    (letter.student?.departments?.name || 'AI&ML')
      .replace(/[^A-Za-z0-9]/g, '')
      .toUpperCase() || 'GEN';
  const created = new Date(letter.created_at);
  const year = Number.isNaN(created.getTime()) ? new Date().getFullYear() : created.getFullYear();
  const shortId = letter.id.replace(/-/g, '').slice(0, 12).toUpperCase();
  return `AITS/${department}/${year}/${shortId}`;
}

async function embedSignature(
  pdfDoc: PDFDocument,
  storagePath: string,
  bytes: ArrayBuffer
): Promise<PDFImage> {
  // Trust the file signature rather than the storage extension. Old uploads
  // could have a mismatched extension, and pdf-lib needs the correct decoder.
  const data = new Uint8Array(bytes);
  const isPng =
    data.length >= 8 &&
    data[0] === 0x89 &&
    data[1] === 0x50 &&
    data[2] === 0x4e &&
    data[3] === 0x47 &&
    data[4] === 0x0d &&
    data[5] === 0x0a &&
    data[6] === 0x1a &&
    data[7] === 0x0a;
  const isJpeg =
    data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;

  if (isPng) return pdfDoc.embedPng(bytes);
  if (isJpeg) return pdfDoc.embedJpg(bytes);

  // Keep the extension as a fallback for unusual but valid image payloads.
  const extension = storagePath.split('.').pop()?.toLowerCase();
  if (extension === 'jpg' || extension === 'jpeg') return pdfDoc.embedJpg(bytes);
  if (extension === 'png') return pdfDoc.embedPng(bytes);

  try {
    return await pdfDoc.embedPng(bytes);
  } catch {
    return pdfDoc.embedJpg(bytes);
  }
}

export async function generateLetterPdf(
  letter: LetterPdfData,
  { origin, mentorSignature, hodSignature }: GenerateOptions
): Promise<{ bytes: Uint8Array; hash: string; referenceNumber: string }> {
  const pdfDoc = await PDFDocument.create();
  const referenceNumber = referenceNumberFor(letter);

  pdfDoc.setTitle(`Letter ${referenceNumber}`);
  pdfDoc.setAuthor('JAM — Campus Letter Automation');
  pdfDoc.setSubject(letter.letter_types?.name || 'Academic Letter');
  pdfDoc.setCreator('JAM');
  pdfDoc.setProducer('JAM / pdf-lib');

  let headerImage: PDFImage | undefined;
  try {
    const headerPath = path.join(process.cwd(), 'header.png');
    if (fs.existsSync(headerPath)) {
      headerImage = await pdfDoc.embedPng(fs.readFileSync(headerPath));
    }
  } catch {
    // The letter still renders with a placeholder header.
  }

  let bodyFont: PDFFont;
  let boldFont: PDFFont;
  let usingCustomFonts = true;

  try {
    bodyFont = await pdfDoc.embedFont(
      fs.readFileSync(path.join(process.cwd(), 'public/fonts/Inter-Regular.ttf'))
    );
    boldFont = await pdfDoc.embedFont(
      fs.readFileSync(path.join(process.cwd(), 'public/fonts/Inter-Bold.ttf'))
    );
  } catch {
    usingCustomFonts = false;
    bodyFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  }

  const clean = (text: string) => (usingCustomFonts ? text : sanitizeForStandardFont(text));

  const gray = rgb(0.4, 0.4, 0.4);
  const black = rgb(0.1, 0.1, 0.1);
  const border = rgb(0.8, 0.8, 0.8);

  const firstPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let page: PDFPage = firstPage;
  let currentY = PAGE_HEIGHT - 130;

  const drawPageChrome = (target: PDFPage) => {
    const watermark = `${referenceNumber}  •  VERIFIED DOCUMENT`;
    const watermarkFont = boldFont;
    const watermarkText = clean(watermark);

    for (const x of [60, 320]) {
      for (const y of [200, 400, 600]) {
        target.drawText(watermarkText, {
          x,
          y,
          size: 11,
          font: watermarkFont,
          color: rgb(0.7, 0.7, 0.7),
          rotate: degrees(30),
          opacity: 0.12,
        });
      }
    }
  };

  const addContinuationPage = (): PDFPage => {
    page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    drawPageChrome(page);
    currentY = PAGE_HEIGHT - MARGIN - 20;
    page.drawText(clean(`Ref: ${referenceNumber}`), {
      x: MARGIN,
      y: PAGE_HEIGHT - MARGIN,
      size: 8,
      font: bodyFont,
      color: gray,
    });
    page.drawLine({
      start: { x: MARGIN, y: PAGE_HEIGHT - MARGIN - 6 },
      end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - MARGIN - 6 },
      color: border,
      thickness: 0.5,
    });
    return page;
  };

  drawPageChrome(firstPage);

  let headerHeight = 80;
  let headerBottomY = PAGE_HEIGHT - 130;

  if (headerImage) {
    const { width: imageWidth, height: imageHeight } = headerImage.scale(1);
    const naturalHeight = CONTENT_WIDTH * (imageHeight / imageWidth);
    headerHeight = Math.min(naturalHeight, 150);
    const headerWidth = headerHeight * (imageWidth / imageHeight);
    headerBottomY = PAGE_HEIGHT - 40 - headerHeight;
    firstPage.drawImage(headerImage, {
      x: MARGIN + Math.max(0, (CONTENT_WIDTH - headerWidth) / 2),
      y: headerBottomY,
      width: headerWidth,
      height: headerHeight,
    });
  } else {
    firstPage.drawRectangle({
      x: MARGIN,
      y: PAGE_HEIGHT - 130,
      width: CONTENT_WIDTH,
      height: headerHeight,
      borderColor: border,
      borderWidth: 1,
    });
    firstPage.drawText(clean('LETTERHEAD PLACEHOLDER'), {
      x: PAGE_WIDTH / 2 - 70,
      y: PAGE_HEIGHT - 95,
      size: 11,
      font: boldFont,
      color: rgb(0.6, 0.6, 0.6),
    });
  }

  currentY = headerBottomY;

  const dateText = `Date: ${formatDateIST(new Date())}`;
  firstPage.drawText(clean(dateText), {
    x: PAGE_WIDTH - MARGIN - bodyFont.widthOfTextAtSize(clean(dateText), 10),
    y: headerBottomY - 25,
    size: 10,
    font: bodyFont,
    color: gray,
  });
  firstPage.drawText(clean(`Ref: ${referenceNumber}`), {
    x: MARGIN,
    y: headerBottomY - 25,
    size: 10,
    font: boldFont,
    color: black,
  });

  let toY = headerBottomY - 50;
  firstPage.drawText(clean('To,'), { x: MARGIN, y: toY, size: 11, font: boldFont, color: black });
  toY -= 15;

  const hodName = letter.hod?.full_name;
  const hasHodName = Boolean(hodName && !hodName.toLowerCase().includes('head of'));

  if (hasHodName && hodName) {
    firstPage.drawText(clean(hodName), { x: MARGIN, y: toY, size: 11, font: bodyFont, color: black });
    toY -= 15;
    firstPage.drawText(clean(letter.hod?.designation || 'Head of the Department'), {
      x: MARGIN,
      y: toY,
      size: 10,
      font: bodyFont,
      color: gray,
    });
  } else {
    firstPage.drawText(clean('The Head of the Department'), {
      x: MARGIN,
      y: toY,
      size: 11,
      font: bodyFont,
      color: black,
    });
  }

  toY -= 15;
  firstPage.drawText(clean(`Department of ${letter.student?.departments?.name || 'AI&ML'}`), {
    x: MARGIN,
    y: toY,
    size: 10,
    font: bodyFont,
    color: gray,
  });
  toY -= 15;
  firstPage.drawText(clean('AITS, Tirupati.'), {
    x: MARGIN,
    y: toY,
    size: 10,
    font: bodyFont,
    color: gray,
  });

  const fromYStart = toY - 30;
  firstPage.drawText(clean('From,'), { x: MARGIN, y: fromYStart, size: 11, font: boldFont, color: black });
  firstPage.drawText(clean(letter.student?.full_name || 'Student'), {
    x: MARGIN,
    y: fromYStart - 15,
    size: 11,
    font: bodyFont,
    color: black,
  });
  firstPage.drawText(clean(`Roll No: ${letter.student?.roll_number || 'N/A'}`), {
    x: MARGIN,
    y: fromYStart - 30,
    size: 10,
    font: bodyFont,
    color: gray,
  });
  firstPage.drawText(clean(`Department of ${letter.student?.departments?.name || 'AI&ML'}`), {
    x: MARGIN,
    y: fromYStart - 45,
    size: 10,
    font: bodyFont,
    color: gray,
  });
  firstPage.drawText(clean('AITS, Tirupati.'), {
    x: MARGIN,
    y: fromYStart - 60,
    size: 10,
    font: bodyFont,
    color: gray,
  });

  const subjectYStart = fromYStart - 90;
  const subjectLine = `Subject: Request for ${letter.letter_types?.name || 'Academic Letter'} - Reg.`;
  firstPage.drawText(clean(subjectLine), {
    x: MARGIN,
    y: subjectYStart,
    size: 11,
    font: boldFont,
    color: black,
  });
  firstPage.drawLine({
    start: { x: MARGIN, y: subjectYStart - 12 },
    end: { x: PAGE_WIDTH - MARGIN, y: subjectYStart - 12 },
    color: border,
    thickness: 0.5,
  });

  currentY = subjectYStart - 35;
  const bodyLines = wrapText(clean(letter.generated_body), CONTENT_WIDTH, bodyFont, BODY_FONT_SIZE);

  for (const line of bodyLines) {
    if (line === '') {
      currentY -= LINE_SPACING * 0.8;
      continue;
    }

    if (currentY - LINE_SPACING < MARGIN + 30) {
      addContinuationPage();
    }

    page.drawText(line, {
      x: MARGIN,
      y: currentY,
      size: BODY_FONT_SIZE,
      font: bodyFont,
      color: black,
      lineHeight: LINE_SPACING,
    });
    currentY -= LINE_SPACING;
  }

  currentY -= 35;

  const ensureSignatureSpace = () => {
    if (currentY - 100 < MARGIN) {
      addContinuationPage();
    }
  };

  ensureSignatureSpace();

  let qrImage: PDFImage | undefined;
  try {
    const verificationUrl = `${origin}/verify/${letter.id}`;
    const qrBuffer = await QRCode.toBuffer(verificationUrl, {
      type: 'png',
      width: 300,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
    qrImage = await pdfDoc.embedPng(qrBuffer);
  } catch {
    // A missing QR code should not block an otherwise valid document.
  }

  if (qrImage) {
    page.drawImage(qrImage, {
      x: MARGIN,
      y: currentY - 70,
      width: 70,
      height: 70,
    });
    page.drawText(clean('Scan to Verify'), {
      x: MARGIN + 3,
      y: currentY - 80,
      size: 7,
      font: bodyFont,
      color: gray,
    });
  }

  const drawSignature = (
    targetPage: PDFPage,
    x: number,
    label: string,
    person: { full_name: string; designation: string | null },
    signature: PDFImage,
    signedAt: string | null
  ) => {
    targetPage.drawText(clean(label), { x, y: currentY, size: 10, font: boldFont, color: black });
    targetPage.drawImage(signature, { x, y: currentY - 50, width: 120, height: 40 });
    targetPage.drawText(clean(person.full_name), {
      x,
      y: currentY - 65,
      size: 10,
      font: boldFont,
      color: black,
    });
    targetPage.drawText(clean(person.designation || 'Faculty'), {
      x,
      y: currentY - 78,
      size: 9,
      font: bodyFont,
      color: gray,
    });
    targetPage.drawText(clean(`Digitally verified on: ${formatDateIST(signedAt || new Date())}`), {
      x,
      y: currentY - 90,
      size: 7.5,
      font: bodyFont,
      color: gray,
    });
  };

  const mentorSignatureImage =
    mentorSignature && letter.mentor?.esign_storage_path
      ? await embedSignature(pdfDoc, letter.mentor.esign_storage_path, mentorSignature)
      : null;

  const hodSignatureImage =
    hodSignature && letter.hod?.esign_storage_path
      ? await embedSignature(pdfDoc, letter.hod.esign_storage_path, hodSignature)
      : null;

  if (mentorSignatureImage && letter.mentor) {
    if (hodSignatureImage && letter.hod) {
      drawSignature(
        page,
        PAGE_WIDTH - MARGIN - 275,
        'Recommended By:',
        letter.mentor,
        mentorSignatureImage,
        letter.mentor_signed_at
      );
      drawSignature(
        page,
        PAGE_WIDTH - MARGIN - 130,
        'Approved & Signed By:',
        letter.hod,
        hodSignatureImage,
        letter.hod_signed_at
      );
    } else {
      drawSignature(
        page,
        PAGE_WIDTH - MARGIN - 130,
        'Approved & Signed By:',
        letter.mentor,
        mentorSignatureImage,
        letter.mentor_signed_at
      );
    }
  }

  const pages = pdfDoc.getPages();
  pages.forEach((targetPage, index) => {
    targetPage.drawText(clean(`Page ${index + 1} of ${pages.length}`), {
      x: PAGE_WIDTH / 2 - 25,
      y: MARGIN / 2,
      size: 7,
      font: bodyFont,
      color: gray,
    });
  });

  const bytes = await pdfDoc.save();
  const hash = crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');

  return { bytes, hash, referenceNumber };
}

export { referenceNumberFor, formatDateIST, wrapText };
