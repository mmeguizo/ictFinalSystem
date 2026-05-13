import ExcelJS from "exceljs";
import { prisma } from "../../lib/prisma";
import { logger } from "../../lib/logger";

export type ReportType =
  | "ticket-summary"
  | "ticket-status"
  | "ticket-category"
  | "ticket-priority"
  | "ticket-monthly"
  | "full-report";

export class ReportService {
  /**
   * Generate an Excel workbook based on report type and optional filters.
   */
  async generateReport(
    type: ReportType,
    filters?: { from?: Date; to?: Date; status?: string; priority?: string },
  ): Promise<ExcelJS.Workbook> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "CHMSU ICT Support System";
    workbook.created = new Date();

    switch (type) {
      case "ticket-summary":
        await this.buildTicketSummarySheet(workbook, filters);
        break;
      case "ticket-status":
        await this.buildStatusBreakdownSheet(workbook, filters);
        break;
      case "ticket-category":
        await this.buildCategoryBreakdownSheet(workbook, filters);
        break;
      case "ticket-priority":
        await this.buildPriorityBreakdownSheet(workbook, filters);
        break;
      case "ticket-monthly":
        await this.buildMonthlyTrendSheet(workbook, filters);
        break;
      case "full-report":
        await this.buildTicketSummarySheet(workbook, filters);
        await this.buildStatusBreakdownSheet(workbook, filters);
        await this.buildCategoryBreakdownSheet(workbook, filters);
        await this.buildPriorityBreakdownSheet(workbook, filters);
        await this.buildMonthlyTrendSheet(workbook, filters);
        await this.buildTicketListSheet(workbook, filters);
        break;
    }

    return workbook;
  }

  private buildDateFilter(filters?: { from?: Date; to?: Date }) {
    const where: any = {};
    if (filters?.from)
      where.createdAt = { ...(where.createdAt || {}), gte: filters.from };
    if (filters?.to)
      where.createdAt = { ...(where.createdAt || {}), lte: filters.to };
    return where;
  }

  private styleHeader(sheet: ExcelJS.Worksheet) {
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1890FF" },
    };
    headerRow.alignment = { horizontal: "center", vertical: "middle" };
    headerRow.height = 24;

    // Auto-fit column widths
    sheet.columns.forEach((col) => {
      if (col.header) {
        col.width = Math.max(col.header.length + 4, 14);
      }
    });
  }

  private async buildTicketSummarySheet(
    workbook: ExcelJS.Workbook,
    filters?: { from?: Date; to?: Date },
  ) {
    const sheet = workbook.addWorksheet("Summary");
    const where = this.buildDateFilter(filters);

    const [total, statusCounts, typeCounts, priorityCounts, avgResolution] =
      await Promise.all([
        prisma.ticket.count({ where }),
        prisma.ticket.groupBy({ by: ["status"], _count: { id: true }, where }),
        prisma.ticket.groupBy({ by: ["type"], _count: { id: true }, where }),
        prisma.ticket.groupBy({
          by: ["priority"],
          _count: { id: true },
          where,
        }),
        prisma.$queryRaw<Array<{ avg_hours: number | null }>>`
          SELECT AVG(TIMESTAMPDIFF(HOUR, createdAt, resolvedAt)) as avg_hours
          FROM Ticket WHERE resolvedAt IS NOT NULL`,
      ]);

    sheet.columns = [
      { header: "Metric", key: "metric", width: 35 },
      { header: "Value", key: "value", width: 20 },
    ];
    this.styleHeader(sheet);

    sheet.addRow({ metric: "Total Tickets", value: total });
    sheet.addRow({});

    // Status breakdown
    sheet.addRow({ metric: "--- By Status ---", value: "" });
    for (const s of statusCounts) {
      sheet.addRow({ metric: `  ${s.status}`, value: s._count.id });
    }
    sheet.addRow({});

    // Type breakdown
    sheet.addRow({ metric: "--- By Type ---", value: "" });
    for (const t of typeCounts) {
      sheet.addRow({ metric: `  ${t.type}`, value: t._count.id });
    }
    sheet.addRow({});

    // Priority breakdown
    sheet.addRow({ metric: "--- By Priority ---", value: "" });
    for (const p of priorityCounts) {
      sheet.addRow({ metric: `  ${p.priority}`, value: p._count.id });
    }
    sheet.addRow({});

    // Average resolution time
    if (avgResolution[0]?.avg_hours) {
      const hours = Math.round(avgResolution[0].avg_hours);
      sheet.addRow({
        metric: "Average Resolution Time",
        value:
          hours >= 24 ? `${Math.round(hours / 24)} days` : `${hours} hours`,
      });
    }
  }

  private async buildStatusBreakdownSheet(
    workbook: ExcelJS.Workbook,
    filters?: { from?: Date; to?: Date },
  ) {
    const sheet = workbook.addWorksheet("By Status");
    const where = this.buildDateFilter(filters);

    const statusCounts = await prisma.ticket.groupBy({
      by: ["status"],
      _count: { id: true },
      where,
    });

    sheet.columns = [
      { header: "Status", key: "status", width: 20 },
      { header: "Count", key: "count", width: 15 },
    ];
    this.styleHeader(sheet);

    for (const s of statusCounts) {
      sheet.addRow({ status: s.status, count: s._count.id });
    }
  }

  private async buildCategoryBreakdownSheet(
    workbook: ExcelJS.Workbook,
    filters?: { from?: Date; to?: Date },
  ) {
    const sheet = workbook.addWorksheet("By Category");
    const where = this.buildDateFilter(filters);

    const typeCounts = await prisma.ticket.groupBy({
      by: ["type"],
      _count: { id: true },
      where,
    });

    sheet.columns = [
      { header: "Category/Type", key: "type", width: 25 },
      { header: "Count", key: "count", width: 15 },
    ];
    this.styleHeader(sheet);

    for (const t of typeCounts) {
      sheet.addRow({ type: t.type, count: t._count.id });
    }
  }

  private async buildPriorityBreakdownSheet(
    workbook: ExcelJS.Workbook,
    filters?: { from?: Date; to?: Date },
  ) {
    const sheet = workbook.addWorksheet("By Priority");
    const where = this.buildDateFilter(filters);

    const priorityCounts = await prisma.ticket.groupBy({
      by: ["priority"],
      _count: { id: true },
      where,
    });

    sheet.columns = [
      { header: "Priority", key: "priority", width: 20 },
      { header: "Count", key: "count", width: 15 },
    ];
    this.styleHeader(sheet);

    for (const p of priorityCounts) {
      sheet.addRow({ priority: p.priority, count: p._count.id });
    }
  }

  private async buildMonthlyTrendSheet(
    workbook: ExcelJS.Workbook,
    _filters?: { from?: Date; to?: Date },
  ) {
    const sheet = workbook.addWorksheet("Monthly Trend");

    const monthlyData = await prisma.$queryRaw<
      Array<{ month: string; total: bigint; resolved: bigint }>
    >`
      SELECT
        DATE_FORMAT(createdAt, '%Y-%m') as month,
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('RESOLVED', 'CLOSED') THEN 1 ELSE 0 END) as resolved
      FROM Ticket
      GROUP BY DATE_FORMAT(createdAt, '%Y-%m')
      ORDER BY month DESC
      LIMIT 12
    `;

    sheet.columns = [
      { header: "Month", key: "month", width: 15 },
      { header: "Total Tickets", key: "total", width: 18 },
      { header: "Resolved", key: "resolved", width: 18 },
      { header: "Resolution Rate", key: "rate", width: 18 },
    ];
    this.styleHeader(sheet);

    for (const row of monthlyData) {
      const total = Number(row.total);
      const resolved = Number(row.resolved);
      const rate =
        total > 0 ? `${Math.round((resolved / total) * 100)}%` : "0%";
      sheet.addRow({ month: row.month, total, resolved, rate });
    }
  }

  private async buildTicketListSheet(
    workbook: ExcelJS.Workbook,
    filters?: { from?: Date; to?: Date; status?: string; priority?: string },
  ) {
    const sheet = workbook.addWorksheet("All Tickets");
    const where: any = this.buildDateFilter(filters);
    if (filters?.status) where.status = filters.status;
    if (filters?.priority) where.priority = filters.priority;

    const tickets = await prisma.ticket.findMany({
      where,
      include: {
        createdBy: { select: { name: true, email: true } },
        assignments: {
          include: { user: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 1000, // Safety limit
    });

    sheet.columns = [
      { header: "Ticket #", key: "ticketNumber", width: 22 },
      { header: "Title", key: "title", width: 35 },
      { header: "Type", key: "type", width: 10 },
      { header: "Status", key: "status", width: 18 },
      { header: "Priority", key: "priority", width: 12 },
      { header: "Created By", key: "createdBy", width: 22 },
      { header: "Assigned To", key: "assignedTo", width: 22 },
      { header: "Created At", key: "createdAt", width: 20 },
      { header: "Resolved At", key: "resolvedAt", width: 20 },
      { header: "Resolution", key: "resolution", width: 40 },
    ];
    this.styleHeader(sheet);

    for (const t of tickets) {
      const assignedTo =
        t.assignments
          ?.map((a: any) => a.user?.name)
          .filter(Boolean)
          .join(", ") ||
        t.assignedDeveloperName ||
        "";
      sheet.addRow({
        ticketNumber: t.ticketNumber,
        title: t.title,
        type: t.type,
        status: t.status,
        priority: t.priority,
        createdBy: t.createdBy?.name || "",
        assignedTo,
        createdAt: t.createdAt ? new Date(t.createdAt).toLocaleString() : "",
        resolvedAt: t.resolvedAt ? new Date(t.resolvedAt).toLocaleString() : "",
        resolution: t.resolution || "",
      });
    }

    // Apply alternating row colors for readability
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1 && rowNumber % 2 === 0) {
        row.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF5F5F5" },
        };
      }
    });
  }
}

export const reportService = new ReportService();
