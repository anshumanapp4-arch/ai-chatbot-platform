// ============================================
// Client: Export Routes — Excel/CSV
// ============================================

import { Router, Request, Response, NextFunction } from 'express';
import ExcelJS from 'exceljs';
import { query } from '../../db/client.js';
import { authenticate } from '../../middleware/auth.js';
import { tenantScope } from '../../middleware/tenantScope.js';
import { decryptPII } from '../../utils/encryption.js';

const router = Router();
router.use(authenticate, tenantScope);

// GET /api/client/exports/leads — Export leads as Excel
router.get('/leads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const format = (req.query.format as string) || 'xlsx';
    const status = req.query.status as string;

    let whereClause = 'WHERE tenant_id = $1';
    const params: unknown[] = [req.tenantId];

    if (status) {
      params.push(status);
      whereClause += ` AND status = $${params.length}`;
    }

    const result = await query(
      `SELECT * FROM leads_orders ${whereClause} ORDER BY created_at DESC`,
      params
    );

    const rows = result.rows.map(row => ({
      ...row,
      customer_name: row.customer_name ? decryptPII(row.customer_name) : '',
      customer_phone: row.customer_phone ? decryptPII(row.customer_phone) : '',
      customer_email: row.customer_email ? decryptPII(row.customer_email) : '',
    }));

    if (format === 'csv') {
      // CSV export
      const headers = ['Type', 'Name', 'Phone', 'Email', 'Request', 'Quantity', 'Status', 'Channel', 'Payment Status', 'Amount', 'Date'];
      const csvRows = rows.map(r =>
        [r.type, r.customer_name, r.customer_phone, r.customer_email, r.request_details, r.quantity, r.status, r.source_channel, r.payment_status, r.payment_amount, r.created_at]
          .map(v => `"${String(v || '').replace(/"/g, '""')}"`)
          .join(',')
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="leads_${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send([headers.join(','), ...csvRows].join('\n'));
    } else {
      // Excel export
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Leads & Orders');

      worksheet.columns = [
        { header: 'Type', key: 'type', width: 10 },
        { header: 'Name', key: 'customer_name', width: 25 },
        { header: 'Phone', key: 'customer_phone', width: 18 },
        { header: 'Email', key: 'customer_email', width: 30 },
        { header: 'Request', key: 'request_details', width: 40 },
        { header: 'Quantity', key: 'quantity', width: 10 },
        { header: 'Notes', key: 'notes', width: 30 },
        { header: 'Status', key: 'status', width: 12 },
        { header: 'Channel', key: 'source_channel', width: 12 },
        { header: 'Payment', key: 'payment_status', width: 12 },
        { header: 'Amount', key: 'payment_amount', width: 12 },
        { header: 'Date', key: 'created_at', width: 20 },
      ];

      // Style header row
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4F46E5' },
      };
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

      rows.forEach(row => worksheet.addRow(row));

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="leads_${new Date().toISOString().slice(0, 10)}.xlsx"`);

      await workbook.xlsx.write(res);
      res.end();
    }
  } catch (error) {
    next(error);
  }
});

export default router;
