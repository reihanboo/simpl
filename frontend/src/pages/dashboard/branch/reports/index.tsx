import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  TrendingUp,
  Package,
  Search,
  Filter,
  Download,
  Calendar,
  ShoppingCart,
  DollarSign,
  BarChart3,
  AlertCircle,
  PackageOpen,
  Loader2,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  Activity
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';

// Types
interface OrderItem {
  id: string;
  product_id: string;
  qty: number;
  unit_price_idr: number;
  subtotal_idr: number;
  Product?: {
    name: string;
    sku: string;
  };
}

interface Order {
  id: string;
  order_number: string;
  total_amount_idr: number;
  discount_amount_idr: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  items: OrderItem[];
}

interface SalesSummary {
  total_orders: number;
  total_revenue: number;
  total_discount: number;
  total_items_sold: number;
}

interface InventoryItem {
  product_id: string;
  product_name: string;
  sku: string;
  current_stock: number;
  cost_price_idr: number;
  selling_price_idr: number;
  stock_value_cost: number;
  stock_value_selling: number;
  low_stock_threshold: number;
  status: string;
}

interface InventorySummary {
  total_products: number;
  total_stock_value_cost: number;
  total_stock_value_selling: number;
  low_stock_count: number;
  out_of_stock_count: number;
}

interface StockMovement {
  id: string;
  date: string;
  sku: string;
  name: string;
  type: string;
  qty: number;
  reason: string;
  user: string;
}

const formatIDR = (num: number) => 'Rp ' + num.toLocaleString('id-ID');
const formatDate = (dateStr: string) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};
const printedAt = () => new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const todayStamp = () => new Date().toISOString().slice(0, 10);

const getDefaultDateRange = () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastDayOfPreviousMonth = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  start.setDate(Math.min(today.getDate(), lastDayOfPreviousMonth));

  const toDateInputValue = (date: Date) => [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');

  return { startDate: toDateInputValue(start), endDate: toDateInputValue(today) };
};

const BRAND_GREEN = 'FF21AC3A';
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
};

interface ExcelColumn {
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  numFmt?: string;
}

interface ExcelReport {
  title: string;
  subtitles: string[];
  summary: { label: string; value: number; numFmt?: string }[];
  columns: ExcelColumn[];
  rows: (string | number)[][];
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const downloadExcelReport = async (filename: string, sheetName: string, report: ExcelReport) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIMPL';
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet(sheetName);
  const colCount = report.columns.length;

  worksheet.columns = report.columns.map(col => ({ width: col.width }));

  // Title band
  worksheet.mergeCells(1, 1, 1, colCount);
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = report.title;
  titleCell.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GREEN } };
  worksheet.getRow(1).height = 30;

  // Subtitles
  report.subtitles.forEach((text, i) => {
    worksheet.mergeCells(2 + i, 1, 2 + i, colCount);
    const cell = worksheet.getCell(2 + i, 1);
    cell.value = text;
    cell.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };
    cell.alignment = { horizontal: 'center' };
  });

  let currentRow = 2 + report.subtitles.length;

  // Summary block
  if (report.summary.length > 0) {
    currentRow += 1;
    report.summary.forEach(item => {
      const labelCell = worksheet.getCell(currentRow, 1);
      labelCell.value = item.label;
      labelCell.font = { bold: true, color: { argb: 'FF334155' } };
      const valueCell = worksheet.getCell(currentRow, 2);
      valueCell.value = item.value;
      valueCell.numFmt = item.numFmt ?? '#,##0';
      valueCell.font = { bold: true, color: { argb: 'FF0F172A' } };
      currentRow += 1;
    });
  }

  // Header row
  currentRow += 1;
  const headerRow = worksheet.getRow(currentRow);
  report.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BRAND_GREEN } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = THIN_BORDER;
  });
  headerRow.height = 22;
  const headerRowIndex = currentRow;

  // Data rows
  report.rows.forEach((dataRow, r) => {
    const row = worksheet.getRow(headerRowIndex + 1 + r);
    dataRow.forEach((value, i) => {
      const col = report.columns[i];
      const cell = row.getCell(i + 1);
      cell.value = value;
      cell.alignment = { vertical: 'middle', horizontal: col.align ?? 'left' };
      if (col.numFmt) cell.numFmt = col.numFmt;
      cell.border = THIN_BORDER;
      if (r % 2 === 1) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      }
    });
  });

  worksheet.views = [{ state: 'frozen', ySplit: headerRowIndex }];

  const buffer = await workbook.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    filename,
  );
};

const pdfBrandHeader = (doc: jsPDF, title: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(33, 172, 58);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(title, 14, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('SIMPL', pageWidth - 14, 18, { align: 'right' });
};

const pdfSummaryCards = (doc: jsPDF, items: { label: string; value: string }[], startY: number): number => {
  if (items.length === 0) return startY;
  const pageWidth = doc.internal.pageSize.getWidth();
  const gap = 4;
  const cardWidth = (pageWidth - 28 - gap * (items.length - 1)) / items.length;
  items.forEach((item, i) => {
    const x = 14 + i * (cardWidth + gap);
    doc.setFillColor(240, 253, 244);
    doc.setDrawColor(187, 247, 208);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, startY, cardWidth, 18, 2, 2, 'FD');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(item.label, x + 3, startY + 7);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(item.value, x + 3, startY + 15);
  });
  doc.setFont('helvetica', 'normal');
  return startY + 24;
};

const pdfFooter = (doc: jsPDF, label: string) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`SIMPL — ${label}`, 14, pageHeight - 8);
    doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth - 14, pageHeight - 8, { align: 'right' });
  }
};

const PDF_TABLE_STYLES = {
  theme: 'striped' as const,
  styles: { fontSize: 9, cellPadding: 3, valign: 'middle' as const, lineColor: [226, 232, 240] as [number, number, number], lineWidth: 0.1 },
  headStyles: { fillColor: [33, 172, 58] as [number, number, number], textColor: 255 as const, fontStyle: 'bold' as const, halign: 'center' as const },
  alternateRowStyles: { fillColor: [246, 250, 247] as [number, number, number] },
  margin: { left: 14, right: 14 },
};

export default function BranchReports() {
  const { id: branchId } = useParams();
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'movement'>('sales');

  // Sales state
  const [defaultDateRange] = useState(getDefaultDateRange);
  const [orders, setOrders] = useState<Order[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesSearch, setSalesSearch] = useState('');
  const [startDate, setStartDate] = useState(defaultDateRange.startDate);
  const [endDate, setEndDate] = useState(defaultDateRange.endDate);

  // Inventory state
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [inventoryLoading, setInventoryLoading] = useState(true);
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState('all');

  // Movement state
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementLoading, setMovementLoading] = useState(true);
  const [movementSearch, setMovementSearch] = useState('');

  // Export menu
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const fetchSalesReport = async () => {
    setSalesLoading(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      let url = `/api/branches/${branchId}/reports/sales`;
      const params = new URLSearchParams();
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
        setSalesSummary(data.summary || null);
      }
    } catch (err) {
      console.error('Failed to fetch sales report', err);
    } finally {
      setSalesLoading(false);
    }
  };

  const fetchInventoryReport = async () => {
    setInventoryLoading(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`/api/branches/${branchId}/reports/inventory`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setInventoryItems(data.items || []);
        setInventorySummary(data.summary || null);
      }
    } catch (err) {
      console.error('Failed to fetch inventory report', err);
    } finally {
      setInventoryLoading(false);
    }
  };

  const fetchMovements = async () => {
    setMovementLoading(true);
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const res = await fetch(`/api/branches/${branchId}/movements`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMovements(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch movements', err);
    } finally {
      setMovementLoading(false);
    }
  };

  useEffect(() => {
    if (branchId) {
      fetchSalesReport();
      fetchInventoryReport();
      fetchMovements();
    }
  }, [branchId]);

  useEffect(() => {
    if (branchId) {
      fetchSalesReport();
    }
  }, [startDate, endDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, salesSearch, inventorySearch, inventoryFilter, movementSearch]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered data
  const filteredOrders = orders.filter(o =>
    o.order_number.toLowerCase().includes(salesSearch.toLowerCase()) ||
    o.payment_method.toLowerCase().includes(salesSearch.toLowerCase())
  );

  const filteredInventory = inventoryItems.filter(item => {
    const matchesSearch =
      item.product_name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
      item.sku.toLowerCase().includes(inventorySearch.toLowerCase());
    const matchesFilter = inventoryFilter === 'all' ? true : item.status === inventoryFilter;
    return matchesSearch && matchesFilter;
  });

  const filteredMovements = movements.filter(m =>
    m.name.toLowerCase().includes(movementSearch.toLowerCase()) ||
    m.sku.toLowerCase().includes(movementSearch.toLowerCase()) ||
    m.reason.toLowerCase().includes(movementSearch.toLowerCase())
  );

  // Pagination
  const currentData = activeTab === 'sales' ? filteredOrders : activeTab === 'inventory' ? filteredInventory : filteredMovements;
  const totalItems = currentData.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginatedInventory = filteredInventory.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const paginatedMovements = filteredMovements.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // PDF Export
  const exportSalesPDF = () => {
    const doc = new jsPDF();
    pdfBrandHeader(doc, 'Laporan Penjualan');

    const dateRange = startDate || endDate
      ? `Periode: ${startDate || '...'} s/d ${endDate || '...'}`
      : 'Semua Periode';
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text(dateRange, 14, 37);
    doc.text(`Dicetak: ${printedAt()}`, doc.internal.pageSize.getWidth() - 14, 37, { align: 'right' });

    const summaryItems = salesSummary ? [
      { label: 'Total Transaksi', value: String(salesSummary.total_orders) },
      { label: 'Total Pendapatan', value: formatIDR(salesSummary.total_revenue) },
      { label: 'Total Item Terjual', value: String(salesSummary.total_items_sold) },
    ] : [];
    const startY = pdfSummaryCards(doc, summaryItems, 44);

    autoTable(doc, {
      ...PDF_TABLE_STYLES,
      startY,
      head: [['No. Order', 'Tanggal', 'Item', 'Pembayaran', 'Total']],
      body: filteredOrders.map(order => [
        order.order_number,
        formatDate(order.created_at),
        order.items.length.toString(),
        order.payment_method.toUpperCase(),
        formatIDR(order.total_amount_idr),
      ]),
      columnStyles: {
        2: { halign: 'center' },
        3: { halign: 'center' },
        4: { halign: 'right' },
      },
    });

    pdfFooter(doc, 'Laporan Penjualan');
    doc.save(`laporan-penjualan-${todayStamp()}.pdf`);
    toast.success('Laporan Penjualan berhasil diunduh!');
  };

  const exportInventoryPDF = () => {
    const doc = new jsPDF('landscape');
    pdfBrandHeader(doc, 'Laporan Inventori');

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text(`Dicetak: ${printedAt()}`, doc.internal.pageSize.getWidth() - 14, 37, { align: 'right' });

    const summaryItems = inventorySummary ? [
      { label: 'Total Produk', value: String(inventorySummary.total_products) },
      { label: 'Nilai Stok (Modal)', value: formatIDR(inventorySummary.total_stock_value_cost) },
      { label: 'Nilai Stok (Jual)', value: formatIDR(inventorySummary.total_stock_value_selling) },
      { label: 'Stok Menipis', value: String(inventorySummary.low_stock_count) },
      { label: 'Stok Habis', value: String(inventorySummary.out_of_stock_count) },
    ] : [];
    const startY = pdfSummaryCards(doc, summaryItems, 44);

    autoTable(doc, {
      ...PDF_TABLE_STYLES,
      startY,
      styles: { ...PDF_TABLE_STYLES.styles, fontSize: 8 },
      head: [['SKU', 'Produk', 'Stok', 'Harga Modal', 'Harga Jual', 'Nilai (Modal)', 'Nilai (Jual)', 'Status']],
      body: filteredInventory.map(item => [
        item.sku,
        item.product_name,
        item.current_stock.toString(),
        formatIDR(item.cost_price_idr),
        formatIDR(item.selling_price_idr),
        formatIDR(item.stock_value_cost),
        formatIDR(item.stock_value_selling),
        item.status,
      ]),
      columnStyles: {
        2: { halign: 'center' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'center' },
      },
    });

    pdfFooter(doc, 'Laporan Inventori');
    doc.save(`laporan-inventori-${todayStamp()}.pdf`);
    toast.success('Laporan Inventori berhasil diunduh!');
  };

  const exportMovementPDF = () => {
    const doc = new jsPDF();
    pdfBrandHeader(doc, 'Laporan Pergerakan Stok');

    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text(`Dicetak: ${printedAt()}`, doc.internal.pageSize.getWidth() - 14, 37, { align: 'right' });

    autoTable(doc, {
      ...PDF_TABLE_STYLES,
      startY: 44,
      head: [['Tanggal', 'SKU', 'Produk', 'Tipe', 'Qty', 'Keterangan']],
      body: filteredMovements.map(m => [
        m.date,
        m.sku,
        m.name,
        m.type === 'in' ? 'Masuk' : m.type === 'out' ? 'Keluar' : 'Penyesuaian',
        m.qty > 0 ? `+${m.qty}` : m.qty.toString(),
        m.reason,
      ]),
      columnStyles: {
        3: { halign: 'center' },
        4: { halign: 'right' },
      },
    });

    pdfFooter(doc, 'Laporan Pergerakan Stok');
    doc.save(`laporan-pergerakan-stok-${todayStamp()}.pdf`);
    toast.success('Laporan Pergerakan Stok berhasil diunduh!');
  };

  const handleExportPDF = () => {
    if (activeTab === 'sales') exportSalesPDF();
    else if (activeTab === 'inventory') exportInventoryPDF();
    else exportMovementPDF();
  };

  const exportSalesExcel = async () => {
    const dateRange = startDate || endDate
      ? `Periode: ${startDate || '...'} s/d ${endDate || '...'}`
      : 'Semua Periode';
    try {
      await downloadExcelReport(`laporan-penjualan-${todayStamp()}.xlsx`, 'Penjualan', {
        title: 'Laporan Penjualan',
        subtitles: [dateRange, `Dicetak: ${printedAt()}`],
        summary: salesSummary ? [
          { label: 'Total Transaksi', value: salesSummary.total_orders },
          { label: 'Total Pendapatan', value: salesSummary.total_revenue, numFmt: '"Rp" #,##0' },
          { label: 'Total Item Terjual', value: salesSummary.total_items_sold },
        ] : [],
        columns: [
          { header: 'No. Order', width: 20 },
          { header: 'Tanggal', width: 24 },
          { header: 'Item', width: 8, align: 'center' },
          { header: 'Pembayaran', width: 14, align: 'center' },
          { header: 'Total', width: 18, align: 'right', numFmt: '"Rp" #,##0' },
        ],
        rows: filteredOrders.map(order => [
          order.order_number,
          formatDate(order.created_at),
          order.items.length,
          order.payment_method.toUpperCase(),
          order.total_amount_idr,
        ]),
      });
      toast.success('Laporan Penjualan (Excel) berhasil diunduh!');
    } catch (err) {
      console.error('Failed to export sales report to Excel', err);
      toast.error('Gagal mengekspor laporan ke Excel');
    }
  };

  const exportInventoryExcel = async () => {
    try {
      await downloadExcelReport(`laporan-inventori-${todayStamp()}.xlsx`, 'Inventori', {
        title: 'Laporan Inventori',
        subtitles: [`Dicetak: ${printedAt()}`],
        summary: inventorySummary ? [
          { label: 'Total Produk', value: inventorySummary.total_products },
          { label: 'Nilai Stok (Modal)', value: inventorySummary.total_stock_value_cost, numFmt: '"Rp" #,##0' },
          { label: 'Nilai Stok (Jual)', value: inventorySummary.total_stock_value_selling, numFmt: '"Rp" #,##0' },
          { label: 'Stok Menipis', value: inventorySummary.low_stock_count },
          { label: 'Stok Habis', value: inventorySummary.out_of_stock_count },
        ] : [],
        columns: [
          { header: 'SKU', width: 16 },
          { header: 'Produk', width: 28 },
          { header: 'Stok', width: 8, align: 'center' },
          { header: 'Harga Modal', width: 16, align: 'right', numFmt: '"Rp" #,##0' },
          { header: 'Harga Jual', width: 16, align: 'right', numFmt: '"Rp" #,##0' },
          { header: 'Nilai (Modal)', width: 18, align: 'right', numFmt: '"Rp" #,##0' },
          { header: 'Nilai (Jual)', width: 18, align: 'right', numFmt: '"Rp" #,##0' },
          { header: 'Status', width: 12, align: 'center' },
        ],
        rows: filteredInventory.map(item => [
          item.sku,
          item.product_name,
          item.current_stock,
          item.cost_price_idr,
          item.selling_price_idr,
          item.stock_value_cost,
          item.stock_value_selling,
          item.status,
        ]),
      });
      toast.success('Laporan Inventori (Excel) berhasil diunduh!');
    } catch (err) {
      console.error('Failed to export inventory report to Excel', err);
      toast.error('Gagal mengekspor laporan ke Excel');
    }
  };

  const exportMovementExcel = async () => {
    try {
      await downloadExcelReport(`laporan-pergerakan-stok-${todayStamp()}.xlsx`, 'Pergerakan Stok', {
        title: 'Laporan Pergerakan Stok',
        subtitles: [`Dicetak: ${printedAt()}`],
        summary: [],
        columns: [
          { header: 'Tanggal', width: 22 },
          { header: 'SKU', width: 16 },
          { header: 'Produk', width: 30 },
          { header: 'Tipe', width: 12, align: 'center' },
          { header: 'Qty', width: 8, align: 'right', numFmt: '#,##0' },
          { header: 'Keterangan', width: 34 },
        ],
        rows: filteredMovements.map(m => [
          m.date,
          m.sku,
          m.name,
          m.type === 'in' ? 'Masuk' : m.type === 'out' ? 'Keluar' : 'Penyesuaian',
          m.qty,
          m.reason,
        ]),
      });
      toast.success('Laporan Pergerakan Stok (Excel) berhasil diunduh!');
    } catch (err) {
      console.error('Failed to export movement report to Excel', err);
      toast.error('Gagal mengekspor laporan ke Excel');
    }
  };

  const handleExportExcel = async () => {
    if (activeTab === 'sales') await exportSalesExcel();
    else if (activeTab === 'inventory') await exportInventoryExcel();
    else await exportMovementExcel();
  };

  return (
    <>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 mb-1">Laporan</h1>
          <p className="text-sm text-slate-500">Pantau kinerja penjualan dan status inventori cabang Anda.</p>
        </div>
        <div className="relative" ref={exportMenuRef}>
          <button
            onClick={() => setIsExportMenuOpen(open => !open)}
            className="px-4 py-2 bg-[#21AC3A] hover:bg-[#1d9732] text-white text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Ekspor
            <ChevronDown className={`w-4 h-4 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {isExportMenuOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 shadow-lg overflow-hidden z-20">
              <button
                onClick={() => { handleExportPDF(); setIsExportMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <FileText className="w-4 h-4 text-red-500" />
                Ekspor PDF
              </button>
              <button
                onClick={() => { handleExportExcel(); setIsExportMenuOpen(false); }}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer border-t border-slate-100"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                Ekspor Excel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {activeTab === 'sales' && salesSummary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
          <div className="bg-white p-4 border border-slate-200 flex items-center gap-3">
            <div className="p-2.5 bg-slate-50 text-slate-600">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Total Transaksi</p>
              <h3 className="text-2xl font-bold text-slate-900">{salesSummary.total_orders}</h3>
            </div>
          </div>
          <div className="bg-white p-4 border border-slate-200 flex items-center gap-3">
            <div className="p-2.5 bg-green-50 text-[#21AC3A]">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Total Pendapatan</p>
              <h3 className="text-2xl font-bold text-slate-900">{formatIDR(salesSummary.total_revenue)}</h3>
            </div>
          </div>
          <div className="bg-white p-4 border border-slate-200 flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-700">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Item Terjual</p>
              <h3 className="text-2xl font-bold text-slate-900">{salesSummary.total_items_sold}</h3>
            </div>
          </div>
          <div className="bg-white p-4 border border-slate-200 flex items-center gap-3">
            <div className="p-2.5 bg-slate-50 text-slate-600">
              <TrendingUp className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Rata-rata / Transaksi</p>
              <h3 className="text-2xl font-bold text-slate-900">
                {salesSummary.total_orders > 0
                  ? formatIDR(Math.round(salesSummary.total_revenue / salesSummary.total_orders))
                  : formatIDR(0)}
              </h3>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && inventorySummary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
          <div className="bg-white p-4 border border-slate-200 flex items-center gap-3">
            <div className="p-2.5 bg-slate-50 text-slate-600">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Total Produk</p>
              <h3 className="text-2xl font-bold text-slate-900">{inventorySummary.total_products}</h3>
            </div>
          </div>
          <div className="bg-white p-4 border border-slate-200 flex items-center gap-3">
            <div className="p-2.5 bg-green-50 text-[#21AC3A]">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Nilai Stok (Jual)</p>
              <h3 className="text-2xl font-bold text-slate-900">{formatIDR(inventorySummary.total_stock_value_selling)}</h3>
            </div>
          </div>
          <div className="bg-white p-4 border border-slate-200 flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 text-amber-700">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Stok Menipis</p>
              <h3 className="text-2xl font-bold text-slate-900">{inventorySummary.low_stock_count}</h3>
            </div>
          </div>
          <div className="bg-white p-4 border border-slate-200 flex items-center gap-3">
            <div className="p-2.5 bg-red-50 text-red-700">
              <PackageOpen className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Stok Habis</p>
              <h3 className="text-2xl font-bold text-slate-900">{inventorySummary.out_of_stock_count}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center overflow-x-auto border border-slate-200 bg-white mb-4">
        <button
          onClick={() => setActiveTab('sales')}
          className={`shrink-0 px-4 py-3 font-medium text-sm transition-colors relative flex items-center gap-2 cursor-pointer ${activeTab === 'sales' ? 'bg-green-50 text-[#21AC3A]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
        >
          <TrendingUp className="w-4 h-4" />
          Laporan Penjualan
        </button>
        <button
          onClick={() => setActiveTab('movement')}
          className={`shrink-0 px-4 py-3 font-medium text-sm transition-colors relative flex items-center gap-2 cursor-pointer ${activeTab === 'movement' ? 'bg-green-50 text-[#21AC3A]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
        >
          <Activity className="w-4 h-4" />
          Pergerakan Stok
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`shrink-0 px-4 py-3 font-medium text-sm transition-colors relative flex items-center gap-2 cursor-pointer ${activeTab === 'inventory' ? 'bg-green-50 text-[#21AC3A]' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}
        >
          <Package className="w-4 h-4" />
          Laporan Inventori
        </button>
      </div>

      {/* Report data */}
      <div className="bg-white border border-slate-200 overflow-hidden flex flex-col">
        {/* Filters */}
        <div className="p-3 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === 'sales' ? 'Cari no. order atau metode bayar...' : activeTab === 'inventory' ? 'Cari nama produk atau SKU...' : 'Cari nama produk, SKU, atau alasan...'}
              value={activeTab === 'sales' ? salesSearch : activeTab === 'inventory' ? inventorySearch : movementSearch}
              onChange={(e) => {
                if (activeTab === 'sales') setSalesSearch(e.target.value);
                else if (activeTab === 'inventory') setInventorySearch(e.target.value);
                else setMovementSearch(e.target.value);
              }}
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-300 focus:outline-none focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A] transition-all"
            />
          </div>
          <div className="flex items-center gap-3">
            {activeTab === 'sales' && (
              <>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-white border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#21AC3A] transition-all"
                  />
                  <span className="text-slate-400">—</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-white border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-[#21AC3A] transition-all"
                  />
                </div>
              </>
            )}
            {activeTab === 'inventory' && (
              <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-300 text-sm text-slate-700">
                <Filter className="w-4 h-4 text-slate-400" />
                <select
                  className="bg-transparent outline-none cursor-pointer"
                  value={inventoryFilter}
                  onChange={(e) => setInventoryFilter(e.target.value)}
                >
                  <option value="all">Semua Status</option>
                  <option value="Aman">Aman</option>
                  <option value="Menipis">Menipis</option>
                  <option value="Habis">Habis</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {activeTab === 'sales' ? (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 font-semibold">No. Order</th>
                  <th className="px-4 py-3 font-semibold">Tanggal & Waktu</th>
                  <th className="px-4 py-3 font-semibold">Jumlah Item</th>
                  <th className="px-4 py-3 font-semibold">Pembayaran</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {salesLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-[#21AC3A] mb-2" />
                        <p>Memuat data laporan...</p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="font-medium">Tidak ada data transaksi.</p>
                      <p className="text-sm mt-1">Ubah filter tanggal atau lakukan transaksi terlebih dahulu.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => (
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={order.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900 font-mono text-xs bg-slate-100 px-2 py-1">
                          {order.order_number}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-medium">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-700">{order.items?.length || 0} item</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                          {order.payment_method}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                          order.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {order.payment_status === 'paid' ? 'Lunas' : 'Refund'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-slate-900">{formatIDR(order.total_amount_idr)}</span>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          ) : activeTab === 'inventory' ? (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 font-semibold">SKU</th>
                  <th className="px-4 py-3 font-semibold">Produk</th>
                  <th className="px-4 py-3 font-semibold">Sisa Stok</th>
                  <th className="px-4 py-3 font-semibold">Harga Modal</th>
                  <th className="px-4 py-3 font-semibold">Harga Jual</th>
                  <th className="px-4 py-3 font-semibold">Nilai Stok (Modal)</th>
                  <th className="px-4 py-3 font-semibold">Nilai Stok (Jual)</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {inventoryLoading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-[#21AC3A] mb-2" />
                        <p>Memuat data inventori...</p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedInventory.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                      <Package className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="font-medium">Tidak ada data produk.</p>
                      <p className="text-sm mt-1">Tambahkan produk melalui halaman Inventori.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedInventory.map((item) => (
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={item.product_id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-500 font-mono font-medium text-xs">
                        {item.sku}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{item.product_name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900">{item.current_stock}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">
                        {formatIDR(item.cost_price_idr)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {formatIDR(item.selling_price_idr)}
                      </td>
                      <td className="px-4 py-3 text-slate-600 font-medium">
                        {formatIDR(item.stock_value_cost)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-700">
                        {formatIDR(item.stock_value_selling)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                          item.status === 'Aman' ? 'bg-emerald-100 text-emerald-700' :
                          item.status === 'Menipis' ? 'bg-amber-100 text-amber-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {item.status}
                        </span>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-3 font-semibold">Tanggal & Waktu</th>
                  <th className="px-4 py-3 font-semibold">SKU</th>
                  <th className="px-4 py-3 font-semibold">Produk</th>
                  <th className="px-4 py-3 font-semibold">Tipe</th>
                  <th className="px-4 py-3 font-semibold">Qty</th>
                  <th className="px-4 py-3 font-semibold">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movementLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-[#21AC3A] mb-2" />
                        <p>Memuat data pergerakan stok...</p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedMovements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                      <Activity className="w-12 h-12 mx-auto mb-3 opacity-20" />
                      <p className="font-medium">Tidak ada pergerakan stok.</p>
                    </td>
                  </tr>
                ) : (
                  paginatedMovements.map((m) => (
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={m.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-500 font-medium">
                        {m.date}
                      </td>
                      <td className="px-4 py-3 text-slate-500 font-mono text-xs">
                        {m.sku}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-slate-900">{m.name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 text-xs font-bold uppercase tracking-wider ${
                          m.type === 'in' ? 'bg-blue-100 text-blue-700' :
                          m.type === 'out' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {m.type === 'in' ? 'Masuk' : m.type === 'out' ? 'Keluar' : 'Penyesuaian'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-bold ${m.qty > 0 ? 'text-blue-600' : m.qty < 0 ? 'text-amber-600' : 'text-slate-600'}`}>
                          {m.qty > 0 ? `+${m.qty}` : m.qty}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {m.reason}
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="p-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap">Tampilkan:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-300 px-2 py-1 outline-none focus:border-[#21AC3A]"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="whitespace-nowrap ml-2">
              Menampilkan {currentData.length} dari {totalItems} data
            </span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Sebelumnya
            </button>
            <button className="px-3 py-1 bg-[#21AC3A] text-white">{currentPage}</button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1 border border-slate-300 hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
