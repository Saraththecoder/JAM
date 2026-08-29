import { NextRequest, NextResponse } from 'next/server';
import { createClientServer, createAdminClient } from '@/lib/supabase/server';
import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// Word-wrap function based on pdf-lib font metrics
function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const paragraphs = text.split('\n');
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (para.trim() === '') {
      lines.push(''); // Preserve empty paragraph lines
      continue;
    }

    const words = para.split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const width = font.widthOfTextAtSize(testLine, fontSize);

      if (width > maxWidth) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
  }

  return lines;
}

import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
    const limitCheck = rateLimit(ip, 10, 60 * 1000);
    if (!limitCheck.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a minute before compiling the letter.' },
        { status: 429 }
      );
    }

    const { letterId } = await request.json();

    if (!letterId) {
      return NextResponse.json({ error: 'Letter ID is required' }, { status: 400 });
    }

    const supabase = await createClientServer();
    const adminClient = createAdminClient();

    // 1. Get current logged-in faculty user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Fetch letter details and ensure this faculty user is the assigned HOD (using adminClient to retrieve sensitive esign_storage_path)
    const { data: letterData, error: letterError } = await adminClient
      .from('letters')
      .select(`
        id,
        created_at,
        generated_body,
        status,
        mentor_id,
        hod_id,
        letter_types (name),
        student:student_id (full_name, roll_number, departments (name)),
        mentor:mentor_id (full_name, designation, esign_storage_path),
        hod:hod_id (full_name, designation, esign_storage_path)
      `)
      .eq('id', letterId)
      .single();

    const letter = letterData as any;

    if (letterError || !letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 });
    }

    const isMentorApproving = letter.status === 'pending_mentor' && letter.mentor_id === user.id && !letter.hod_id;
    const isHodApproving = letter.status === 'pending_hod' && letter.hod_id === user.id;

    if (!isMentorApproving && !isHodApproving) {
      return NextResponse.json(
        { error: 'You do not have active review permission for this approval step.' },
        { status: 403 }
      );
    }

    if (isMentorApproving && !letter.mentor?.esign_storage_path) {
      return NextResponse.json(
        { error: 'Class Mentor must have uploaded a digital signature before final approval.' },
        { status: 400 }
      );
    }

    if (isHodApproving && (!letter.mentor?.esign_storage_path || !letter.hod?.esign_storage_path)) {
      return NextResponse.json(
        { error: 'Both Mentor and HOD must have uploaded digital signatures before final approval.' },
        { status: 400 }
      );
    }

    // 4. Download faculty signatures from signatures private storage bucket
    let mentorSignArrayBuffer: ArrayBuffer | null = null;
    let hodSignArrayBuffer: ArrayBuffer | null = null;

    // Download Mentor signature
    if (letter.mentor?.esign_storage_path) {
      const { data: mentorSignatureBlob, error: mentorDownloadError } = await adminClient.storage
        .from('signatures')
        .download(letter.mentor.esign_storage_path);

      if (mentorDownloadError || !mentorSignatureBlob) {
        console.error('Failed to download Mentor e-signature:', mentorDownloadError);
        return NextResponse.json(
          { error: 'Could not fetch Mentor e-signature image.' },
          { status: 500 }
        );
      }
      mentorSignArrayBuffer = await mentorSignatureBlob.arrayBuffer();
    }

    // Download HOD signature
    if (letter.hod_id && letter.hod?.esign_storage_path) {
      const { data: hodSignatureBlob, error: hodDownloadError } = await adminClient.storage
        .from('signatures')
        .download(letter.hod.esign_storage_path);

      if (hodDownloadError || !hodSignatureBlob) {
        console.error('Failed to download HOD e-signature:', hodDownloadError);
        return NextResponse.json(
          { error: 'Could not fetch HOD e-signature image.' },
          { status: 500 }
        );
      }
      hodSignArrayBuffer = await hodSignatureBlob.arrayBuffer();
    }

    // Generate unique reference number: AITS/AIML/[YEAR]/[UUID_SHORT]
    const deptNameClean = (letter.student.departments?.name || 'AIML').replace('&', '');
    const letterYear = new Date(letter.created_at).getFullYear();
    const shortUuid = letter.id.slice(0, 5).toUpperCase();
    const refNumber = `AITS/${deptNameClean}/${letterYear}/${shortUuid}`;

    // 5. Compile PDF using pdf-lib
    const pdfDoc = await PDFDocument.create();

    // Try to load local header.png image
    let headerImageEmbed;
    try {
      const headerPath = path.join(process.cwd(), 'header.png');
      if (fs.existsSync(headerPath)) {
        const headerBytes = fs.readFileSync(headerPath);
        headerImageEmbed = await pdfDoc.embedPng(headerBytes);
      }
    } catch (e) {
      console.error('Failed to load header.png image:', e);
    }

    // Fetch dynamic QR code image bytes
    let qrImage;
    try {
      const origin = request.nextUrl.origin;
      const verificationUrl = `${origin}/verify/${letterId}`;
      const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(verificationUrl)}`;
      const qrResponse = await fetch(qrApiUrl);
      if (qrResponse.ok) {
        const qrBuffer = await qrResponse.arrayBuffer();
        qrImage = await pdfDoc.embedPng(qrBuffer);
      }
    } catch (e) {
      console.error('Failed to fetch verification QR code:', e);
    }
    
    // Page size A4: 595.27 x 841.89
    const page = pdfDoc.addPage([595.27, 841.89]);
    const { width, height } = page.getSize();

    // Load custom premium fonts (Inter)
    let helvetica;
    let helveticaBold;
    try {
      const fontRegularBytes = fs.readFileSync(path.join(process.cwd(), 'public/fonts/Inter-Regular.ttf'));
      const fontBoldBytes = fs.readFileSync(path.join(process.cwd(), 'public/fonts/Inter-Bold.ttf'));
      helvetica = await pdfDoc.embedFont(fontRegularBytes);
      helveticaBold = await pdfDoc.embedFont(fontBoldBytes);
    } catch (e) {
      console.warn('Failed to load custom Inter fonts, falling back to standard Helvetica:', e);
      helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
      helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }

    // Color definitions
    const grayColor = rgb(0.4, 0.4, 0.4);
    const blackColor = rgb(0.1, 0.1, 0.1);
    const borderCol = rgb(0.8, 0.8, 0.8);

    // --- RENDER DYNAMIC WATERMARK BACKGROUND ---
    const watermarkText = `${refNumber}  •  VERIFIED DOCUMENT`;
    const watermarkFont = helveticaBold;
    const watermarkFontSize = 11;
    const watermarkColor = rgb(0.7, 0.7, 0.7);
    const watermarkOpacity = 0.12;

    // Draw diagonal watermarks in a 3x2 grid to cover the page background under the text
    const cols = [60, 320];
    const rows = [200, 400, 600];

    for (const cx of cols) {
      for (const ry of rows) {
        page.drawText(watermarkText, {
          x: cx,
          y: ry,
          size: watermarkFontSize,
          font: watermarkFont,
          color: watermarkColor,
          rotate: degrees(30),
          opacity: watermarkOpacity,
        });
      }
    }

    // Margins and dimensions
    const margin = 50;
    const contentWidth = width - margin * 2; // 495.27

    // --- RENDER HEADER / LETTERHEAD ---
    let headerHeight = 80;
    let headerBottomY = height - 130;
    if (headerImageEmbed) {
      const { width: imgWidth, height: imgHeight } = headerImageEmbed.scale(1);
      // Calculate dynamic height to maintain original aspect ratio
      headerHeight = contentWidth * (imgHeight / imgWidth);
      headerBottomY = height - 40 - headerHeight;
      page.drawImage(headerImageEmbed, {
        x: margin,
        y: headerBottomY,
        width: contentWidth,
        height: headerHeight,
      });
    } else {
      // Fallback placeholder box
      page.drawRectangle({
        x: margin,
        y: height - 130,
        width: contentWidth,
        height: headerHeight,
        borderColor: borderCol,
        borderWidth: 1,
      });
      page.drawText('LETTERHEAD PLACEHOLDER (100px HEIGHT)', {
        x: width / 2 - 130,
        y: height - 95,
        size: 11,
        font: helveticaBold,
        color: rgb(0.6, 0.6, 0.6),
      });
    }

    // --- SAFE DATE FORMATTER ---
    const formatDate = (dateInput: any) => {
      const d = dateInput ? new Date(dateInput) : new Date();
      const validDate = isNaN(d.getTime()) ? new Date() : d;
      const day = String(validDate.getDate()).padStart(2, '0');
      const month = String(validDate.getMonth() + 1).padStart(2, '0');
      const year = validDate.getFullYear();
      return `${day}/${month}/${year}`;
    };

    // --- RENDER REFERENCE NUMBER & DATE ---
    const dateStr = `Date: ${formatDate(new Date())}`;
    page.drawText(dateStr, {
      x: width - margin - helvetica.widthOfTextAtSize(dateStr, 10),
      y: headerBottomY - 25,
      size: 10,
      font: helvetica,
      color: grayColor,
    });

    page.drawText(`Ref: ${refNumber}`, {
      x: margin,
      y: headerBottomY - 25,
      size: 10,
      font: helveticaBold,
      color: blackColor,
    });

    // --- RENDER TO ADDRESS ---
    page.drawText('To,', { x: margin, y: headerBottomY - 50, size: 11, font: helveticaBold, color: blackColor });
    
    let toY = headerBottomY - 65;
    const hodName = letter.hod?.full_name;
    const hasHodName = hodName && !hodName.toLowerCase().includes('head of');
    
    if (hasHodName) {
      page.drawText(hodName, { x: margin, y: toY, size: 11, font: helvetica, color: blackColor });
      toY -= 15;
      page.drawText(letter.hod?.designation || 'Head of the Department', { x: margin, y: toY, size: 10, font: helvetica, color: grayColor });
    } else {
      page.drawText('The Head of the Department', { x: margin, y: toY, size: 11, font: helvetica, color: blackColor });
    }
    
    toY -= 15;
    page.drawText(`Department of ${letter.student?.departments?.name || 'AI&ML'}`, { x: margin, y: toY, size: 10, font: helvetica, color: grayColor });
    toY -= 15;
    page.drawText('AITS, Tirupati.', { x: margin, y: toY, size: 10, font: helvetica, color: grayColor });

    // Since toY ends at the last line of "To" address, render "From" address relatively
    const fromYStart = toY - 30; // 30px spacing between To and From blocks

    // --- RENDER FROM ADDRESS ---
    page.drawText('From,', { x: margin, y: fromYStart, size: 11, font: helveticaBold, color: blackColor });
    page.drawText(letter.student?.full_name || 'Student', { x: margin, y: fromYStart - 15, size: 11, font: helvetica, color: blackColor });
    page.drawText(`Roll No: ${letter.student?.roll_number || 'N/A'}`, { x: margin, y: fromYStart - 30, size: 10, font: helvetica, color: grayColor });
    page.drawText(`Department of ${letter.student?.departments?.name || 'AI&ML'}`, { x: margin, y: fromYStart - 45, size: 10, font: helvetica, color: grayColor });
    page.drawText('AITS, Tirupati.', { x: margin, y: fromYStart - 60, size: 10, font: helvetica, color: grayColor });

    const subjectYStart = fromYStart - 90; // Spacing below From block

    // --- RENDER SUBJECT LINE ---
    const subjectLine = `Subject: Request for ${letter.letter_types?.name || 'Academic Letter'} - Reg.`;
    page.drawText(subjectLine, {
      x: margin,
      y: subjectYStart,
      size: 11,
      font: helveticaBold,
      color: blackColor,
    });

    // Draw horizontal separator line below Subject metadata
    page.drawLine({
      start: { x: margin, y: subjectYStart - 12 },
      end: { x: width - margin, y: subjectYStart - 12 },
      color: borderCol,
      thickness: 0.5,
    });

    // --- RENDER BODY PARAGRAPHS (Wrapped) ---
    const wrapFontSize = 11;
    const lineSpacing = 18; // Increased from 16 to 18 for premium spacing
    const bodyLines = wrapText(letter.generated_body, contentWidth, helvetica, wrapFontSize);
    
    let currentY = subjectYStart - 35; // Positioned dynamically relative to Subject line
    
    for (const line of bodyLines) {
      if (line === '') {
        currentY -= lineSpacing * 0.8;
        continue;
      }
      
      page.drawText(line, {
        x: margin,
        y: currentY,
        size: wrapFontSize,
        font: helvetica,
        color: blackColor,
        lineHeight: lineSpacing,
      });
      currentY -= lineSpacing;
    }

    // --- RENDER CLOSING, SIGNATURES & QR CODE ---
    currentY -= 35; // Spacing after body

    // Render verification QR code on the bottom left
    if (qrImage) {
      page.drawImage(qrImage, {
        x: margin,
        y: currentY - 70,
        width: 70,
        height: 70,
      });
      page.drawText('Scan to Verify', {
        x: margin + 3,
        y: currentY - 80,
        size: 7,
        font: helvetica,
        color: grayColor,
      });
    }

    // Close columns layout for e-signatures
    if (!letter.hod_id && mentorSignArrayBuffer) {
      // Single signature: Mentor signs as the final approver
      const signX = width - margin - 130;
      page.drawText('Approved & Signed By:', { x: signX, y: currentY, size: 10, font: helveticaBold, color: blackColor });

      let mentorImage;
      const mentorExt = letter.mentor.esign_storage_path.split('.').pop()?.toLowerCase();
      if (mentorExt === 'jpg' || mentorExt === 'jpeg') {
        mentorImage = await pdfDoc.embedJpg(mentorSignArrayBuffer);
      } else {
        mentorImage = await pdfDoc.embedPng(mentorSignArrayBuffer);
      }
      page.drawImage(mentorImage, {
        x: signX,
        y: currentY - 50,
        width: 120,
        height: 40,
      });
      page.drawText(letter.mentor.full_name, { x: signX, y: currentY - 65, size: 10, font: helveticaBold, color: blackColor });
      page.drawText(letter.mentor.designation, { x: signX, y: currentY - 78, size: 9, font: helvetica, color: grayColor });
      
      page.drawText(`Digitally verified on: ${formatDate(new Date())}`, { 
        x: signX, 
        y: currentY - 90, 
        size: 7.5, 
        font: helvetica, 
        color: grayColor 
      });
    } else if (mentorSignArrayBuffer && hodSignArrayBuffer) {
      // Double signature: Mentor recommended (middle right), HOD approved (far right)
      const mentorX = width - margin - 275;
      page.drawText('Recommended By:', { x: mentorX, y: currentY, size: 10, font: helveticaBold, color: blackColor });

      let mentorImage;
      const mentorExt = letter.mentor.esign_storage_path.split('.').pop()?.toLowerCase();
      if (mentorExt === 'jpg' || mentorExt === 'jpeg') {
        mentorImage = await pdfDoc.embedJpg(mentorSignArrayBuffer);
      } else {
        mentorImage = await pdfDoc.embedPng(mentorSignArrayBuffer);
      }
      page.drawImage(mentorImage, {
        x: mentorX,
        y: currentY - 50,
        width: 120,
        height: 40,
      });
      page.drawText(letter.mentor.full_name, { x: mentorX, y: currentY - 65, size: 10, font: helveticaBold, color: blackColor });
      page.drawText(letter.mentor.designation, { x: mentorX, y: currentY - 78, size: 9, font: helvetica, color: grayColor });

      const hodX = width - margin - 130;
      page.drawText('Approved & Signed By:', { x: hodX, y: currentY, size: 10, font: helveticaBold, color: blackColor });

      let hodImage;
      const hodExt = letter.hod.esign_storage_path.split('.').pop()?.toLowerCase();
      if (hodExt === 'jpg' || hodExt === 'jpeg') {
        hodImage = await pdfDoc.embedJpg(hodSignArrayBuffer);
      } else {
        hodImage = await pdfDoc.embedPng(hodSignArrayBuffer);
      }
      page.drawImage(hodImage, {
        x: hodX,
        y: currentY - 50,
        width: 120,
        height: 40,
      });
      page.drawText(letter.hod.full_name, { x: hodX, y: currentY - 65, size: 10, font: helveticaBold, color: blackColor });
      page.drawText(letter.hod.designation, { x: hodX, y: currentY - 78, size: 9, font: helvetica, color: grayColor });
      
      page.drawText(`Digitally verified on: ${formatDate(new Date())}`, { 
        x: hodX, 
        y: currentY - 90, 
        size: 7.5, 
        font: helvetica, 
        color: grayColor 
      });
    }

    // Save PDF as bytes
    const pdfBytes = await pdfDoc.save();
    const pdfHash = crypto.createHash('sha256').update(Buffer.from(pdfBytes)).digest('hex');
 
    // 6. Upload compiled PDF to private 'letters' bucket
    const pdfPath = `${letterId}.pdf`;
    
    const { error: uploadError } = await adminClient.storage
      .from('letters')
      .upload(pdfPath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });
 
    if (uploadError) {
      console.error('PDF upload error:', uploadError);
      return NextResponse.json(
        { error: `Failed to store signed PDF: ${uploadError.message}` },
        { status: 500 }
      );
    }
 
    // 7. Update letters record in the database
    const updatePayload = {
      status: 'approved',
      pdf_storage_path: pdfPath,
      reference_number: refNumber,
      mentor_signed_at: letter.mentor_signed_at || new Date().toISOString(),
      hod_signed_at: letter.hod_id ? new Date().toISOString() : null,
      pdf_hash: pdfHash,
    };

    const { error: updateError } = await adminClient
      .from('letters')
      .update(updatePayload)
      .eq('id', letterId);

    if (updateError) {
      console.error('Letter database update error:', updateError);
      return NextResponse.json(
        { error: `Failed to update letter status: ${updateError.message}` },
        { status: 550 }
      );
    }

    // 8. Fire Resend email notification (asynchronous, non-blocking)
    fetch(`${request.nextUrl.origin}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        letterId: letterId,
        type: 'approval',
      }),
    }).catch((e) => console.error('Failed to trigger approval email notification:', e));

    return NextResponse.json({ success: true, pdfPath });
  } catch (error: any) {
    console.error('Unexpected approve-letter error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
