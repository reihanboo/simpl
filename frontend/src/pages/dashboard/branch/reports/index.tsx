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
import * as XLSX from 'xlsx';

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

const saveExcel = (filename: string, sheetName: string, rows: (string | number)[][], cols: { wch: number }[]) => {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = cols;
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
};

export default function BranchReports() {
  const { id: branchId } = useParams();
  const [activeTab, setActiveTab] = useState<'sales' | 'inventory' | 'movement'>('sales');

  // Sales state
  const [orders, setOrders] = useState<Order[]>([]);
  const [salesSummary, setSalesSummary] = useState<SalesSummary | null>(null);
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesSearch, setSalesSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

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
    doc.setFontSize(18);
    doc.text('Laporan Penjualan', 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100);
    const dateRange = startDate || endDate
      ? `Periode: ${startDate || '...'} s/d ${endDate || '...'}`
      : 'Semua Periode';
    doc.text(dateRange, 14, 30);
    doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 14, 36);

    // Summary
    if (salesSummary) {
      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.text(`Total Transaksi: ${salesSummary.total_orders}`, 14, 46);
      doc.text(`Total Pendapatan: ${formatIDR(salesSummary.total_revenue)}`, 14, 52);
      doc.text(`Total Item Terjual: ${salesSummary.total_items_sold}`, 14, 58);
    }

    const tableData = filteredOrders.map(order => [
      order.order_number,
      formatDate(order.created_at),
      order.items.length.toString(),
      order.payment_method.toUpperCase(),
      formatIDR(order.total_amount_idr),
    ]);

    autoTable(doc, {
      startY: 64,
      head: [['No. Order', 'Tanggal', 'Item', 'Pembayaran', 'Total']],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [33, 172, 58] },
    });

    doc.save(`laporan-penjualan-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('Laporan Penjualan berhasil diunduh!');
  };

  const exportInventoryPDF = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text('Laporan Inventori', 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 14, 30);

    // Summary
    if (inventorySummary) {
      doc.setFontSize(11);
      doc.setTextColor(0);
      doc.text(`Total Produk: ${inventorySummary.total_products}`, 14, 40);
      doc.text(`Nilai Stok (Modal): ${formatIDR(inventorySummary.total_stock_value_cost)}`, 14, 46);
      doc.text(`Nilai Stok (Jual): ${formatIDR(inventorySummary.total_stock_value_selling)}`, 14, 52);
      doc.text(`Stok Menipis: ${inventorySummary.low_stock_count}  |  Stok Habis: ${inventorySummary.out_of_stock_count}`, 14, 58);
    }

    const tableData = filteredInventory.map(item => [
      item.sku,
      item.product_name,
      item.current_stock.toString(),
      formatIDR(item.cost_price_idr),
      formatIDR(item.selling_price_idr),
      formatIDR(item.stock_value_cost),
      formatIDR(item.stock_value_selling),
      item.status,
    ]);

    autoTable(doc, {
      startY: 64,
      head: [['SKU', 'Produk', 'Stok', 'Harga Modal', 'Harga Jual', 'Nilai (Modal)', 'Nilai (Jual)', 'Status']],
      body: tableData,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [33, 172, 58] },
    });

    doc.save(`laporan-inventori-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('Laporan Inventori berhasil diunduh!');
  };

  const exportMovementPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Laporan Pergerakan Stok', 14, 22);

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, 14, 30);

    const tableData = filteredMovements.map(m => [
      m.date,
      m.sku,
      m.name,
      m.type === 'in' ? 'Masuk' : m.type === 'out' ? 'Keluar' : 'Penyesuaian',
      m.qty > 0 ? `+${m.qty}` : m.qty.toString(),
      m.reason,
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Tanggal', 'SKU', 'Produk', 'Tipe', 'Qty', 'Keterangan']],
      body: tableData,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [33, 172, 58] },
    });

    doc.save(`laporan-pergerakan-stok-${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success('Laporan Pergerakan Stok berhasil diunduh!');
  };

  const handleExportPDF = () => {
    if (activeTab === 'sales') exportSalesPDF();
    else if (activeTab === 'inventory') exportInventoryPDF();
    else exportMovementPDF();
  };

  const exportSalesExcel = () => {
    const rows: (string | number)[][] = [['Laporan Penjualan']];
    const dateRange = startDate || endDate
      ? `Periode: ${startDate || '...'} s/d ${endDate || '...'}`
      : 'Semua Periode';
    rows.push([dateRange]);
    rows.push([`Dicetak: ${printedAt()}`]);
    rows.push([]);

    if (salesSummary) {
      rows.push(['Total Transaksi', salesSummary.total_orders]);
      rows.push(['Total Pendapatan', salesSummary.total_revenue]);
      rows.push(['Total Item Terjual', salesSummary.total_items_sold]);
      rows.push([]);
    }

    rows.push(['No. Order', 'Tanggal', 'Item', 'Pembayaran', 'Total (IDR)']);
    filteredOrders.forEach(order => {
      rows.push([
        order.order_number,
        formatDate(order.created_at),
        order.items.length,
        order.payment_method.toUpperCase(),
        order.total_amount_idr,
      ]);
    });

    saveExcel(`laporan-penjualan-${todayStamp()}.xlsx`, 'Penjualan', rows, [
      { wch: 20 }, { wch: 24 }, { wch: 8 }, { wch: 14 }, { wch: 18 },
    ]);
    toast.success('Laporan Penjualan (Excel) berhasil diunduh!');
  };

  const exportInventoryExcel = () => {
    const rows: (string | number)[][] = [['Laporan Inventori']];
    rows.push([`Dicetak: ${printedAt()}`]);
    rows.push([]);

    if (inventorySummary) {
      rows.push(['Total Produk', inventorySummary.total_products]);
      rows.push(['Nilai Stok (Modal)', inventorySummary.total_stock_value_cost]);
      rows.push(['Nilai Stok (Jual)', inventorySummary.total_stock_value_selling]);
      rows.push(['Stok Menipis', inventorySummary.low_stock_count]);
      rows.push(['Stok Habis', inventorySummary.out_of_stock_count]);
      rows.push([]);
    }

    rows.push(['SKU', 'Produk', 'Stok', 'Harga Modal', 'Harga Jual', 'Nilai (Modal)', 'Nilai (Jual)', 'Status']);
    filteredInventory.forEach(item => {
      rows.push([
        item.sku,
        item.product_name,
        item.current_stock,
        item.cost_price_idr,
        item.selling_price_idr,
        item.stock_value_cost,
        item.stock_value_selling,
        item.status,
      ]);
    });

    saveExcel(`laporan-inventori-${todayStamp()}.xlsx`, 'Inventori', rows, [
      { wch: 16 }, { wch: 28 }, { wch: 8 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 12 },
    ]);
    toast.success('Laporan Inventori (Excel) berhasil diunduh!');
  };

  const exportMovementExcel = () => {
    const rows: (string | number)[][] = [['Laporan Pergerakan Stok']];
    rows.push([`Dicetak: ${printedAt()}`]);
    rows.push([]);

    rows.push(['Tanggal', 'SKU', 'Produk', 'Tipe', 'Qty', 'Keterangan']);
    filteredMovements.forEach(m => {
      rows.push([
        m.date,
        m.sku,
        m.name,
        m.type === 'in' ? 'Masuk' : m.type === 'out' ? 'Keluar' : 'Penyesuaian',
        m.qty,
        m.reason,
      ]);
    });

    saveExcel(`laporan-pergerakan-stok-${todayStamp()}.xlsx`, 'Pergerakan Stok', rows, [
      { wch: 22 }, { wch: 16 }, { wch: 28 }, { wch: 12 }, { wch: 8 }, { wch: 30 },
    ]);
    toast.success('Laporan Pergerakan Stok (Excel) berhasil diunduh!');
  };

  const handleExportExcel = () => {
    if (activeTab === 'sales') exportSalesExcel();
    else if (activeTab === 'inventory') exportInventoryExcel();
    else exportMovementExcel();
  };

  return (
    <>
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Laporan</h1>
          <p className="text-slate-500">Pantau kinerja penjualan dan status inventori cabang Anda.</p>
        </div>
        <div className="relative" ref={exportMenuRef}>
          <button
            onClick={() => setIsExportMenuOpen(open => !open)}
            className="px-4 py-2 bg-[#21AC3A] hover:bg-[#1d9732] text-white rounded-lg text-sm font-semibold transition-colors shadow-sm flex items-center gap-2 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Ekspor
            <ChevronDown className={`w-4 h-4 transition-transform ${isExportMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {isExportMenuOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden z-20">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Transaksi</p>
              <h3 className="text-2xl font-bold text-slate-900">{salesSummary.total_orders}</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Pendapatan</p>
              <h3 className="text-2xl font-bold text-slate-900">{formatIDR(salesSummary.total_revenue)}</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Item Terjual</p>
              <h3 className="text-2xl font-bold text-slate-900">{salesSummary.total_items_sold}</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-violet-50 text-violet-600 rounded-xl">
              <TrendingUp className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Rata-rata / Transaksi</p>
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Package className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Produk</p>
              <h3 className="text-2xl font-bold text-slate-900">{inventorySummary.total_products}</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Nilai Stok (Jual)</p>
              <h3 className="text-2xl font-bold text-slate-900">{formatIDR(inventorySummary.total_stock_value_selling)}</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Stok Menipis</p>
              <h3 className="text-2xl font-bold text-slate-900">{inventorySummary.low_stock_count}</h3>
            </div>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-xl">
              <PackageOpen className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Stok Habis</p>
              <h3 className="text-2xl font-bold text-slate-900">{inventorySummary.out_of_stock_count}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-6 border-b border-slate-200 mb-6">
        <button
          onClick={() => setActiveTab('sales')}
          className={`pb-3 font-semibold text-sm transition-colors relative flex items-center gap-2 cursor-pointer ${activeTab === 'sales' ? 'text-[#21AC3A]' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <TrendingUp className="w-4 h-4" />
          Laporan Penjualan
          {activeTab === 'sales' && (
            <motion.div layoutId="report-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#21AC3A] rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('inventory')}
          className={`pb-3 font-semibold text-sm transition-colors relative flex items-center gap-2 cursor-pointer ${activeTab === 'inventory' ? 'text-[#21AC3A]' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <Package className="w-4 h-4" />
          Laporan Inventori
          {activeTab === 'inventory' && (
            <motion.div layoutId="report-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#21AC3A] rounded-t-full" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('movement')}
          className={`pb-3 font-semibold text-sm transition-colors relative flex items-center gap-2 cursor-pointer ${activeTab === 'movement' ? 'text-[#21AC3A]' : 'text-slate-500 hover:text-slate-900'}`}
        >
          <Activity className="w-4 h-4" />
          Pergerakan Stok
          {activeTab === 'movement' && (
            <motion.div layoutId="report-tab-indicator" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#21AC3A] rounded-t-full" />
          )}
        </button>
      </div>

      {/* Table Card */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between gap-4">
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
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A] transition-all"
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
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#21AC3A] transition-all"
                  />
                  <span className="text-slate-400">—</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-[#21AC3A] transition-all"
                  />
                </div>
              </>
            )}
            {activeTab === 'inventory' && (
              <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700">
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
                  <th className="px-6 py-4 font-semibold">No. Order</th>
                  <th className="px-6 py-4 font-semibold">Tanggal & Waktu</th>
                  <th className="px-6 py-4 font-semibold">Jumlah Item</th>
                  <th className="px-6 py-4 font-semibold">Pembayaran</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Total</th>
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
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-900 font-mono text-xs bg-slate-100 px-2 py-1 rounded-md">
                          {order.order_number}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-medium">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-700">{order.items?.length || 0} item</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-700">
                          {order.payment_method}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                          order.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {order.payment_status === 'paid' ? 'Lunas' : 'Refund'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
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
                  <th className="px-6 py-4 font-semibold">SKU</th>
                  <th className="px-6 py-4 font-semibold">Produk</th>
                  <th className="px-6 py-4 font-semibold">Sisa Stok</th>
                  <th className="px-6 py-4 font-semibold">Harga Modal</th>
                  <th className="px-6 py-4 font-semibold">Harga Jual</th>
                  <th className="px-6 py-4 font-semibold">Nilai Stok (Modal)</th>
                  <th className="px-6 py-4 font-semibold">Nilai Stok (Jual)</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
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
                      <td className="px-6 py-4 text-slate-500 font-mono font-medium text-xs">
                        {item.sku}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">{item.product_name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-slate-900">{item.current_stock}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {formatIDR(item.cost_price_idr)}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700">
                        {formatIDR(item.selling_price_idr)}
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-medium">
                        {formatIDR(item.stock_value_cost)}
                      </td>
                      <td className="px-6 py-4 font-semibold text-slate-700">
                        {formatIDR(item.stock_value_selling)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
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
                  <th className="px-6 py-4 font-semibold">Tanggal & Waktu</th>
                  <th className="px-6 py-4 font-semibold">SKU</th>
                  <th className="px-6 py-4 font-semibold">Produk</th>
                  <th className="px-6 py-4 font-semibold">Tipe</th>
                  <th className="px-6 py-4 font-semibold">Qty</th>
                  <th className="px-6 py-4 font-semibold">Keterangan</th>
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
                      <td className="px-6 py-4 text-slate-500 font-medium">
                        {m.date}
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-mono text-xs">
                        {m.sku}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-slate-900">{m.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                          m.type === 'in' ? 'bg-blue-100 text-blue-700' :
                          m.type === 'out' ? 'bg-amber-100 text-amber-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {m.type === 'in' ? 'Masuk' : m.type === 'out' ? 'Keluar' : 'Penyesuaian'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-bold ${m.qty > 0 ? 'text-blue-600' : m.qty < 0 ? 'text-amber-600' : 'text-slate-600'}`}>
                          {m.qty > 0 ? `+${m.qty}` : m.qty}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500">
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
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap">Tampilkan:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-[#21AC3A]"
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
              className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Sebelumnya
            </button>
            <button className="px-3 py-1 bg-[#21AC3A] text-white rounded">{currentPage}</button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
