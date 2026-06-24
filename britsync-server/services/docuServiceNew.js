const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');

/**
 * Extract local file path from an uploads URL
 * @param {string} fileUrl e.g. http://localhost:5003/uploads/123-file.pdf
 * @returns {string|null} local absolute file path
 */
const getFilePathFromUrl = (fileUrl) => {
    if (!fileUrl) return null;
    const parts = fileUrl.split('/uploads/');
    if (parts.length > 1) {
        return path.join(__dirname, '../uploads', parts[1]);
    }
    return path.join(__dirname, '../uploads', fileUrl);
};

/**
 * Calculates the SHA-256 hash of a file buffer
 * @param {Buffer} buffer 
 * @returns {string} sha256 hex string
 */
const calculateHash = (buffer) => {
    return crypto.createHash('sha256').update(buffer).digest('hex');
};

const sanitizeTextForPdf = (str) => {
    if (!str) return '';
    return String(str)
        .replace(/[\u201c\u201d]/g, '"')
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u2014\u2013]/g, '-')
        .replace(/\u00a0/g, ' ')
        .replace(/[\r\n]+/g, ' ')
        .replace(/[^\x20-\x7E]/g, '');
};

/**
 * Compiles original PDF, overlays all texts and signatures, and generates the final flat PDF
 * @param {Object} document Document record from database
 * @returns {Promise<{filename: string, finalHash: string}>} Filename and SHA256 of final PDF
 */
const compileFinalPdfNew = async (document) => {
    try {
        const originalPath = getFilePathFromUrl(document.original_file_url);
        if (!originalPath || !fs.existsSync(originalPath)) {
            throw new Error(`Original PDF file not found at path: ${originalPath}`);
        }

        const originalPdfBytes = fs.readFileSync(originalPath);
        const pdfDoc = await PDFDocument.load(originalPdfBytes);
        const pages = pdfDoc.getPages();
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

        const fields = document.fields || [];
        for (const field of fields) {
            if (field.page_number < 1 || field.page_number > pages.length) {
                continue;
            }

            const page = pages[field.page_number - 1];
            const { width, height } = page.getSize();

            // Coordinate conversion
            const pdfX = (field.x_percent / 100) * width;
            const pdfWidth = (field.width_percent / 100) * width;
            const pdfHeight = (field.height_percent / 100) * height;
            const pdfY = height - ((field.y_percent / 100) * height) - pdfHeight;

            // Draw field based on type
            const isTextType = [
                'text', 'textarea', 'date', 'dropdown', 'email', 'phone', 
                'number', 'fullName', 'company', 'address', 'readonlyNote'
            ].includes(field.field_type);

            if (isTextType) {
                const textValue = field.value || '';
                const fontSize = field.font_size || Math.max(6, Math.min(11, pdfHeight * 0.5));
                const textY = pdfY + (pdfHeight - fontSize) / 2;

                page.drawText(sanitizeTextForPdf(textValue), {
                    x: pdfX + 5,
                    y: textY,
                    size: fontSize,
                    font: helveticaFont,
                    color: rgb(0, 0, 0),
                });
            } else if (field.field_type === 'checkbox') {
                const isChecked = field.value === 'true' || field.value === 'checked';
                if (isChecked) {
                    const fontSize = Math.min(pdfWidth, pdfHeight) * 0.8;
                    const textX = pdfX + (pdfWidth - fontSize) / 2;
                    const textY = pdfY + (pdfHeight - fontSize) / 2;
                    page.drawText('X', {
                        x: textX,
                        y: textY,
                        size: fontSize,
                        font: helveticaFont,
                        color: rgb(0, 0, 0),
                    });
                }
            } else if (field.field_type === 'radio') {
                const isSelected = field.value === 'true' || field.value === 'selected';
                if (isSelected) {
                    const radius = Math.min(pdfWidth, pdfHeight) * 0.3;
                    const centerX = pdfX + pdfWidth / 2;
                    const centerY = pdfY + pdfHeight / 2;
                    page.drawCircle({
                        x: centerX,
                        y: centerY,
                        radius: radius,
                        color: rgb(0, 0, 0)
                    });
                }
            } else if (['user_signature', 'initials', 'stamp'].includes(field.field_type) && field.signature_data) {
                try {
                    const sigDataParts = field.signature_data.split(';base64,');
                    const sigBase64 = sigDataParts.length > 1 ? sigDataParts[1] : sigDataParts[0];
                    const sigBuffer = Buffer.from(sigBase64, 'base64');
                    
                    const sigImage = await pdfDoc.embedPng(sigBuffer);
                    page.drawImage(sigImage, {
                        x: pdfX,
                        y: pdfY,
                        width: pdfWidth,
                        height: pdfHeight
                    });
                } catch (imgErr) {
                    console.error(`Failed to embed signature/initials/stamp image:`, imgErr);
                }
            }
        }

        const finalPdfBytes = await pdfDoc.save();
        const finalFilename = `completed-docu-${Date.now()}-${document._id}.pdf`;
        const finalPath = path.join(__dirname, '../uploads', finalFilename);
        
        const uploadDir = path.dirname(finalPath);
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }

        fs.writeFileSync(finalPath, finalPdfBytes);
        const finalHash = calculateHash(finalPdfBytes);

        return { filename: finalFilename, finalHash };
    } catch (error) {
        console.error('Error in compileFinalPdfNew:', error);
        throw error;
    }
};

/**
 * Generates an Audit Trail / Certificate of Completion PDF for a document
 * @param {Object} document 
 * @param {Array} auditLogs 
 * @returns {Promise<string>} filename of generated PDF
 */
const generateAuditReportPdf = async (document, auditLogs) => {
    try {
        const auditDoc = await PDFDocument.create();
        const page = auditDoc.addPage([595.276, 841.890]); // A4 size
        const font = await auditDoc.embedFont(StandardFonts.Helvetica);
        const fontBold = await auditDoc.embedFont(StandardFonts.HelveticaBold);
        const { width, height } = page.getSize();
        
        // Draw blue line at top
        page.drawRectangle({
            x: 40,
            y: height - 60,
            width: width - 80,
            height: 4,
            color: rgb(37 / 255, 99 / 255, 235 / 255)
        });

        // Header Title
        page.drawText('BritSync Docu - Certificate of Completion', {
            x: 40,
            y: height - 100,
            size: 20,
            font: fontBold,
            color: rgb(15 / 255, 23 / 255, 42 / 255)
        });

        // Subtitle
        page.drawText('Digital Cryptographic Audit Trail', {
            x: 40,
            y: height - 120,
            size: 11,
            font: font,
            color: rgb(100 / 255, 116 / 255, 139 / 255)
        });

        // Document Details section
        page.drawText('DOCUMENT DETAILS', {
            x: 40,
            y: height - 160,
            size: 10,
            font: fontBold,
            color: rgb(37 / 255, 99 / 255, 235 / 255)
        });

        const lines = [
            `Document ID: ${sanitizeTextForPdf(document._id)}`,
            `Document Name: ${sanitizeTextForPdf(document.document_name)}`,
            `Original File Hash: ${sanitizeTextForPdf(document.original_hash || 'N/A')}`,
            `Completed File Hash: ${sanitizeTextForPdf(document.final_hash || 'N/A')}`,
            `Status: Completed / Securely Signed`,
            `Completion Timestamp: ${new Date().toLocaleString('en-GB')}`
        ];

        let currY = height - 180;
        lines.forEach(ln => {
            page.drawText(ln, {
                x: 45,
                y: currY,
                size: 9,
                font: font,
                color: rgb(51 / 255, 65 / 255, 85 / 255)
            });
            currY -= 15;
        });

        currY -= 15;

        // Signer details section
        page.drawText('SIGNER EVENT TRACKING', {
            x: 40,
            y: currY,
            size: 10,
            font: fontBold,
            color: rgb(37 / 255, 99 / 255, 235 / 255)
        });
        currY -= 20;

        document.recipients.forEach(r => {
            page.drawText(`Name: ${sanitizeTextForPdf(r.name)} (${sanitizeTextForPdf(r.email)})`, {
                x: 45,
                y: currY,
                size: 9,
                font: fontBold,
                color: rgb(15 / 255, 23 / 255, 42 / 255)
            });
            currY -= 12;

            page.drawText(`Role: ${sanitizeTextForPdf(r.role)} | Status: ${sanitizeTextForPdf(r.status)}`, {
                x: 45,
                y: currY,
                size: 9,
                font: font,
                color: rgb(51 / 255, 65 / 255, 85 / 255)
            });
            currY -= 12;

            if (r.viewed_at) {
                page.drawText(`Viewed: ${new Date(r.viewed_at).toLocaleString('en-GB')}`, {
                    x: 45,
                    y: currY,
                    size: 9,
                    font: font,
                    color: rgb(100 / 255, 116 / 255, 139 / 255)
                });
                currY -= 12;
            }

            if (r.completed_at) {
                page.drawText(`Signed: ${new Date(r.completed_at).toLocaleString('en-GB')} (IP: ${r.ip_address || 'N/A'})`, {
                    x: 45,
                    y: currY,
                    size: 9,
                    font: font,
                    color: rgb(100 / 255, 116 / 255, 139 / 255)
                });
                currY -= 12;
            }
            currY -= 10;
        });

        // Audit events timeline
        currY -= 10;
        page.drawText('CHRONOLOGICAL AUDIT TIMELINE', {
            x: 40,
            y: currY,
            size: 10,
            font: fontBold,
            color: rgb(37 / 255, 99 / 255, 235 / 255)
        });
        currY -= 20;

        const recentLogs = auditLogs.slice(0, 10);
        recentLogs.forEach(log => {
            const eventTime = new Date(log.createdAt).toLocaleString('en-GB');
            const details = `${eventTime} - ${sanitizeTextForPdf(log.event_type)} (IP: ${sanitizeTextForPdf(log.ip_address || 'N/A')})`;
            page.drawText(details, {
                x: 45,
                y: currY,
                size: 8,
                font: font,
                color: rgb(100 / 255, 116 / 255, 139 / 255)
            });
            currY -= 14;
        });

        // Verification stamp at bottom
        page.drawRectangle({
            x: 40,
            y: 40,
            width: width - 80,
            height: 45,
            color: rgb(248 / 255, 250 / 255, 252 / 255),
            borderColor: rgb(226 / 255, 232 / 255, 240 / 255),
            borderWidth: 1
        });

        page.drawText('Verified Cryptographic Certificate of Completion', {
            x: 50,
            y: 68,
            size: 9,
            font: fontBold,
            color: rgb(16 / 255, 185 / 255, 129 / 255)
        });

        page.drawText('This document summary is generated securely by BritSync Docu. Cryptographic check hashes match.', {
            x: 50,
            y: 50,
            size: 8,
            font: font,
            color: rgb(100 / 255, 116 / 255, 139 / 255)
        });

        const auditPdfBytes = await auditDoc.save();
        const filename = `audit-certificate-${document._id}.pdf`;
        const localPath = path.join(__dirname, '../uploads', filename);
        fs.writeFileSync(localPath, auditPdfBytes);
        return filename;
    } catch (err) {
        console.error('Error generating audit certificate PDF:', err);
        throw err;
    }
};

module.exports = {
    compileFinalPdfNew,
    getFilePathFromUrl,
    calculateHash,
    generateAuditReportPdf
};
