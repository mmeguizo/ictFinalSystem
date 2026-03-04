import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import type {
  TicketAnalytics,
  SLAMetrics,
  TicketTrends,
  StaffPerformance,
} from './analytics.service';

@Injectable({ providedIn: 'root' })
export class ExportService {

  // ========================================
  // PDF EXPORT
  // ========================================

  exportAnalyticsPDF(
    analytics: TicketAnalytics | null,
    sla: SLAMetrics | null,
    trends: TicketTrends | null,
    staff: StaffPerformance[],
  ): void {
    const doc = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Title
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('ICT Service Request Analytics Report', pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, y, { align: 'center' });
    y += 12;

    // ---- Overview Summary ----
    if (analytics) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Overview Summary', 14, y);
      y += 8;

      const summaryData = [
        ['Total Tickets', String(analytics.total)],
        ['By Status', analytics.byStatus.map(s => `${s.status}: ${s.count}`).join(', ')],
        ['By Type', analytics.byType.map(t => `${t.type}: ${t.count}`).join(', ')],
      ];

      autoTable(doc, {
        startY: y,
        head: [['Metric', 'Value']],
        body: summaryData,
        theme: 'grid',
        headStyles: { fillColor: [24, 144, 255] },
        margin: { left: 14, right: 14 },
        tableWidth: 120,
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // ---- Tickets by Status ----
    if (analytics && analytics.byStatus?.length) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Tickets by Status', 14, y);
      y += 8;

      autoTable(doc, {
        startY: y,
        head: [['Status', 'Count']],
        body: analytics.byStatus.map(s => [s.status.replace(/_/g, ' '), String(s.count)]),
        theme: 'grid',
        headStyles: { fillColor: [24, 144, 255] },
        margin: { left: 14, right: 14 },
        tableWidth: 120,
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // ---- Tickets by Priority ----
    if (analytics && analytics.byPriority?.length) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Tickets by Priority', 14, y);
      y += 8;

      autoTable(doc, {
        startY: y,
        head: [['Priority', 'Count']],
        body: analytics.byPriority.map(p => [p.priority, String(p.count)]),
        theme: 'grid',
        headStyles: { fillColor: [24, 144, 255] },
        margin: { left: 14, right: 14 },
        tableWidth: 120,
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // ---- SLA Metrics ----
    if (sla) {
      // New page if needed
      if (y > 160) { doc.addPage(); y = 20; }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('SLA Compliance', 14, y);
      y += 8;

      const slaData = [
        ['Compliance Rate', `${sla.complianceRate?.toFixed(1) ?? 'N/A'}%`],
        ['Total Resolved', String(sla.totalResolved ?? 'N/A')],
        ['Resolved within SLA', String(sla.resolvedWithinSLA ?? 'N/A')],
        ['Avg Resolution (hours)', String(sla.averageResolutionHours?.toFixed(1) ?? 'N/A')],
        ['Overdue Tickets', String(sla.overdueTickets?.length ?? 0)],
      ];

      autoTable(doc, {
        startY: y,
        head: [['SLA Metric', 'Value']],
        body: slaData,
        theme: 'grid',
        headStyles: { fillColor: [82, 196, 26] },
        margin: { left: 14, right: 14 },
        tableWidth: 160,
      });
      y = (doc as any).lastAutoTable.finalY + 10;

      // Overdue tickets table
      if (sla.overdueTickets?.length) {
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text('Overdue Tickets', 14, y);
        y += 6;

        autoTable(doc, {
          startY: y,
          head: [['Ticket #', 'Title', 'Priority', 'Due Date', 'Hours Overdue']],
          body: sla.overdueTickets.map(t => [
            t.ticketNumber,
            t.title.substring(0, 40),
            t.priority,
            new Date(t.dueDate).toLocaleDateString(),
            String(Math.round((Date.now() - new Date(t.dueDate).getTime()) / 3600000)),
          ]),
          theme: 'grid',
          headStyles: { fillColor: [255, 77, 79] },
          margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 10;
      }
    }

    // ---- Staff Performance ----
    if (staff?.length) {
      if (y > 140) { doc.addPage(); y = 20; }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Staff Performance', 14, y);
      y += 8;

      autoTable(doc, {
        startY: y,
        head: [['Staff Name', 'Assigned', 'Resolved', 'In Progress', 'Avg Resolution (hrs)']],
        body: staff.map(s => [
          s.name,
          String(s.totalAssigned),
          String(s.totalResolved),
          `${s.slaComplianceRate?.toFixed(1) ?? 'N/A'}%`,
          s.averageResolutionHours?.toFixed(1) ?? 'N/A',
        ]),
        theme: 'grid',
        headStyles: { fillColor: [114, 46, 209] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // ---- Trends ----
    if (trends?.createdPerDay?.length) {
      if (y > 140) { doc.addPage(); y = 20; }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Daily Ticket Trends', 14, y);
      y += 8;

      // Merge created and resolved trends by date
      const dateMap = new Map<string, { created: number; resolved: number }>();
      trends.createdPerDay.forEach(d => {
        const entry = dateMap.get(d.date) || { created: 0, resolved: 0 };
        entry.created = d.count;
        dateMap.set(d.date, entry);
      });
      trends.resolvedPerDay?.forEach(d => {
        const entry = dateMap.get(d.date) || { created: 0, resolved: 0 };
        entry.resolved = d.count;
        dateMap.set(d.date, entry);
      });

      autoTable(doc, {
        startY: y,
        head: [['Date', 'Created', 'Resolved']],
        body: Array.from(dateMap.entries()).sort().map(([date, v]) => [
          date,
          String(v.created),
          String(v.resolved),
        ]),
        theme: 'grid',
        headStyles: { fillColor: [24, 144, 255] },
        margin: { left: 14, right: 14 },
        tableWidth: 150,
      });
    }

    // Footer on each page
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(
        `CHMSU ICT Service Request Analytics - Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' },
      );
    }

    doc.save(`ICT_Analytics_Report_${this.getFileDateStr()}.pdf`);
  }

  // ========================================
  // EXCEL EXPORT
  // ========================================

  exportAnalyticsExcel(
    analytics: TicketAnalytics | null,
    sla: SLAMetrics | null,
    trends: TicketTrends | null,
    staff: StaffPerformance[],
  ): void {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Overview
    if (analytics) {
      const overviewData = [
        ['ICT Service Request Analytics Report'],
        [`Generated: ${new Date().toLocaleString()}`],
        [],
        ['Metric', 'Value'],
        ['Total Tickets', analytics.total],
        [],
        ['Status Breakdown'],
        ['Status', 'Count'],
        ...analytics.byStatus.map(s => [s.status.replace(/_/g, ' '), s.count]),
        [],
        ['Priority Breakdown'],
        ['Priority', 'Count'],
        ...analytics.byPriority.map(p => [p.priority, p.count]),
        [],
        ['Type Breakdown'],
        ['Type', 'Count'],
        ...analytics.byType.map(t => [t.type, t.count]),
      ];
      const ws1 = XLSX.utils.aoa_to_sheet(overviewData);
      ws1['!cols'] = [{ wch: 30 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws1, 'Overview');
    }

    // Sheet 2: SLA Metrics
    if (sla) {
      const slaData = [
        ['SLA Compliance Dashboard'],
        [],
        ['Metric', 'Value'],
        ['Compliance Rate', `${sla.complianceRate?.toFixed(1) ?? 'N/A'}%`],
        ['Total Resolved', sla.totalResolved ?? 'N/A'],
        ['Resolved within SLA', sla.resolvedWithinSLA ?? 'N/A'],
        ['Avg Resolution (hours)', sla.averageResolutionHours?.toFixed(1) ?? 'N/A'],
        ['Overdue Tickets Count', sla.overdueTickets?.length ?? 0],
      ];

      if (sla.overdueTickets?.length) {
        slaData.push(
          [],
          ['Overdue Tickets'],
          ['Ticket #', 'Title', 'Priority', 'Status', 'Due Date'] as any,
          ...sla.overdueTickets.map(t => [
            t.ticketNumber,
            t.title,
            t.priority,
            t.status,
            new Date(t.dueDate).toLocaleDateString(),
          ]),
        );
      }

      const ws2 = XLSX.utils.aoa_to_sheet(slaData);
      ws2['!cols'] = [{ wch: 25 }, { wch: 40 }, { wch: 12 }, { wch: 15 }, { wch: 15 }];
      XLSX.utils.book_append_sheet(wb, ws2, 'SLA Metrics');
    }

    // Sheet 3: Staff Performance
    if (staff?.length) {
      const staffData = [
        ['Staff Performance Report'],
        [],
        ['Name', 'Assigned', 'Resolved', 'SLA Compliance %', 'Avg Resolution (hrs)'],
        ...staff.map(s => [
          s.name,
          s.totalAssigned,
          s.totalResolved,
          s.slaComplianceRate?.toFixed(1) ?? 'N/A',
          s.averageResolutionHours?.toFixed(1) ?? 'N/A',
        ]),
      ];
      const ws3 = XLSX.utils.aoa_to_sheet(staffData);
      ws3['!cols'] = [{ wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 15 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, ws3, 'Staff Performance');
    }

    // Sheet 4: Trends
    if (trends?.createdPerDay?.length) {
      const dateMap = new Map<string, { created: number; resolved: number }>();
      trends.createdPerDay.forEach((d: { date: string; count: number }) => {
        const entry = dateMap.get(d.date) || { created: 0, resolved: 0 };
        entry.created = d.count;
        dateMap.set(d.date, entry);
      });
      trends.resolvedPerDay?.forEach((d: { date: string; count: number }) => {
        const entry = dateMap.get(d.date) || { created: 0, resolved: 0 };
        entry.resolved = d.count;
        dateMap.set(d.date, entry);
      });

      const trendsData = [
        ['Daily Ticket Trends'],
        [],
        ['Date', 'Created', 'Resolved'],
        ...Array.from(dateMap.entries()).sort().map(([date, v]) => [date, v.created, v.resolved]),
      ];
      const ws4 = XLSX.utils.aoa_to_sheet(trendsData);
      ws4['!cols'] = [{ wch: 15 }, { wch: 12 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws4, 'Trends');
    }

    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([wbout], { type: 'application/octet-stream' });
    saveAs(blob, `ICT_Analytics_Report_${this.getFileDateStr()}.xlsx`);
  }

  // ========================================
  // UTILITY
  // ========================================

  private getFileDateStr(): string {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  }
}
