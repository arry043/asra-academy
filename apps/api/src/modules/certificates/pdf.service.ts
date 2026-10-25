import fs from 'node:fs';
import path from 'node:path';
import PDFDocument from 'pdfkit';

export interface CertificatePdfData {
  certificateNumber: string;
  recipientName: string;
  courseTitle: string;
  completedAt: Date;
  issuedAt: Date;
  verificationUrl: string;
}

/**
 * Searches for the ASRA Academy emblem file across likely locations in monorepo workspaces.
 */
function findEmblemPath(): string | null {
  const candidates = [
    path.resolve(process.cwd(), 'apps/web/public/brand/asra-academy-emblem.png'),
    path.resolve(process.cwd(), '../web/public/brand/asra-academy-emblem.png'),
    path.resolve(process.cwd(), '../../apps/web/public/brand/asra-academy-emblem.png'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

/**
 * Generates an official, publication-grade landscape A4 PDF certificate.
 * Utilizes ASRA Academy's green and gold design tokens.
 */
export async function generateCertificatePdf(data: CertificatePdfData): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      // Landscape A4: width 841.89 pt, height 595.28 pt
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        info: {
          Title: `Certificate of Completion - ${data.recipientName} - ${data.courseTitle}`,
          Author: 'ASRA Academy',
          Subject: `Certificate ${data.certificateNumber}`,
          Keywords: 'ASRA Academy, Certificate, Completion, Verification',
          Creator: 'ASRA Academy LMS',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const width = doc.page.width;
      const height = doc.page.height;

      // 1. Background fill (Ivory / warm cream)
      doc.rect(0, 0, width, height).fill('#FDFBF7');

      // 2. Borders
      // Outer Gold Border (rich gold #C88717)
      doc
        .rect(20, 20, width - 40, height - 40)
        .lineWidth(3)
        .strokeColor('#C88717')
        .stroke();

      // Middle Dark Green Border (#012114)
      doc
        .rect(26, 26, width - 52, height - 52)
        .lineWidth(1)
        .strokeColor('#012114')
        .stroke();

      // Inner Fine Accent Border (#C88717)
      doc
        .rect(30, 30, width - 60, height - 60)
        .lineWidth(0.5)
        .strokeColor('#D89E34')
        .stroke();

      // Corner Corner Accents (Decorative Diamonds)
      const drawCornerDiamond = (x: number, y: number) => {
        doc
          .save()
          .translate(x, y)
          .rotate(45)
          .rect(-4, -4, 8, 8)
          .fillAndStroke('#C88717', '#012114')
          .restore();
      };
      drawCornerDiamond(26, 26);
      drawCornerDiamond(width - 26, 26);
      drawCornerDiamond(26, height - 26);
      drawCornerDiamond(width - 26, height - 26);

      // 3. Header & Emblem
      const emblemPath = findEmblemPath();
      let currentY = 48;

      if (emblemPath) {
        doc.image(emblemPath, width / 2 - 25, currentY, { width: 50 });
        currentY += 58;
      } else {
        currentY += 10;
      }

      // Academy Name
      doc
        .font('Helvetica-Bold')
        .fontSize(22)
        .fillColor('#012114')
        .text('ASRA ACADEMY', 0, currentY, { align: 'center', characterSpacing: 2 });
      currentY += 26;

      // Sub-heading
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor('#C88717')
        .text('ACADEMY OF ISLAMIC & CONTEMPORARY STUDIES', 0, currentY, {
          align: 'center',
          characterSpacing: 2,
        });
      currentY += 28;

      // 4. Document Title: CERTIFICATE OF COMPLETION
      doc
        .font('Helvetica-Bold')
        .fontSize(20)
        .fillColor('#034729')
        .text('CERTIFICATE OF COMPLETION', 0, currentY, {
          align: 'center',
          characterSpacing: 3,
        });
      currentY += 26;

      // Gold Divider with Center Accent
      doc
        .moveTo(width / 2 - 120, currentY)
        .lineTo(width / 2 + 120, currentY)
        .lineWidth(1)
        .strokeColor('#C88717')
        .stroke();

      doc
        .circle(width / 2, currentY, 3)
        .fillColor('#034729')
        .fill();
      currentY += 18;

      // 5. Presentation Text
      doc
        .font('Helvetica-Oblique')
        .fontSize(12)
        .fillColor('#4A5568')
        .text('This is to certify that', 0, currentY, { align: 'center' });
      currentY += 24;

      // 6. Recipient Name
      doc
        .font('Helvetica-Bold')
        .fontSize(26)
        .fillColor('#012114')
        .text(data.recipientName, 60, currentY, { align: 'center', width: width - 120 });
      currentY += 34;

      // Subtle Underline for Recipient Name
      doc
        .moveTo(width / 2 - 160, currentY)
        .lineTo(width / 2 + 160, currentY)
        .lineWidth(1)
        .strokeColor('#D89E34')
        .stroke();
      currentY += 16;

      // 7. Course Completion Text
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor('#4A5568')
        .text(
          'has successfully completed the curriculum and all required assessments for the course',
          0,
          currentY,
          {
            align: 'center',
          },
        );
      currentY += 22;

      // 8. Course Title
      doc
        .font('Helvetica-Bold')
        .fontSize(20)
        .fillColor('#034729')
        .text(data.courseTitle, 60, currentY, { align: 'center', width: width - 120 });
      currentY += 34;

      // 9. Details & Metadata Block (Left: Dates, Right: Verification & ID)
      const footerY = height - 125;

      // Left Column: Dates
      const leftColX = 65;
      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#012114')
        .text('COMPLETION DATE', leftColX, footerY)
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#2D3748')
        .text(formatDate(data.completedAt), leftColX, footerY + 14)
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor('#012114')
        .text('ISSUED DATE', leftColX, footerY + 34)
        .font('Helvetica')
        .fontSize(10)
        .fillColor('#2D3748')
        .text(formatDate(data.issuedAt), leftColX, footerY + 48);

      // Center Column: Official Seal Graphic
      const centerColX = width / 2;
      doc
        .circle(centerColX, footerY + 28, 28)
        .lineWidth(1.5)
        .strokeColor('#C88717')
        .stroke();
      doc
        .circle(centerColX, footerY + 28, 24)
        .lineWidth(0.5)
        .strokeColor('#034729')
        .stroke();
      doc
        .font('Helvetica-Bold')
        .fontSize(7)
        .fillColor('#034729')
        .text('OFFICIAL', centerColX - 25, footerY + 18, { width: 50, align: 'center' })
        .text('SEAL', centerColX - 25, footerY + 28, { width: 50, align: 'center' })
        .font('Helvetica')
        .fontSize(6)
        .fillColor('#C88717')
        .text('ASRA ACADEMY', centerColX - 35, footerY + 38, { width: 70, align: 'center' });

      // Right Column: Signatory
      const rightColWidth = 180;
      const rightColX = width - 65 - rightColWidth;

      // Signature line
      doc
        .moveTo(rightColX, footerY + 38)
        .lineTo(rightColX + rightColWidth, footerY + 38)
        .lineWidth(1)
        .strokeColor('#A0AEC0')
        .stroke();

      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor('#012114')
        .text('Authorized Signatory', rightColX, footerY + 44, {
          width: rightColWidth,
          align: 'center',
        })
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor('#718096')
        .text('Academic Director, ASRA Academy', rightColX, footerY + 58, {
          width: rightColWidth,
          align: 'center',
        });

      // 10. Bottom Bar: Verification URL & Certificate Number
      const bottomBarY = height - 42;
      doc
        .moveTo(50, bottomBarY - 6)
        .lineTo(width - 50, bottomBarY - 6)
        .lineWidth(0.5)
        .strokeColor('#E2E8F0')
        .stroke();

      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor('#718096')
        .text(`Certificate ID: `, 50, bottomBarY, { continued: true })
        .font('Helvetica-Bold')
        .fillColor('#012114')
        .text(data.certificateNumber, { continued: true })
        .font('Helvetica')
        .fillColor('#718096')
        .text(`   ·   Verify authenticity online at: `, { continued: true })
        .font('Helvetica')
        .fillColor('#034729')
        .text(data.verificationUrl);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
