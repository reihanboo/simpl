import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Scanner } from "@yudiel/react-qr-scanner";
import toast from "react-hot-toast";
import {
  Search,
  Plus,
  Filter,
  ArrowUpDown,
  AlertCircle,
  PackageCheck,
  PackageOpen,
  ArrowDownToLine,
  ArrowUpFromLine,
  BoxSelect,
  X,
  Loader2,
  Trash2,
  Pencil,
  CalendarClock,
  PackagePlus,
  Boxes,
  Timer,
  ScanLine,
  RefreshCw,
} from "lucide-react";
import { useParams } from "react-router-dom";

interface InventoryProduct {
  id: string;
  product_id: string;
  name: string;
  sku: string;
  cost_price_idr?: number | null;
  selling_price_idr: number;
  low_stock_threshold: number;
  current_stock: number;
  status: string;
}

interface ForecastItem {
  product_id: string;
  name: string;
  sku: string;
  current_stock: number;
  low_stock_threshold: number;
  cost_price_idr: number;
  selling_price_idr: number;
  avg_daily_demand: number;
  stddev_daily_demand: number;
  smoothed_daily_demand: number;
  predicted_demand: number;
  safety_stock: number;
  reorder_point: number;
  recommended_reorder_qty: number;
  days_of_cover: number | null;
  estimated_stockout_date: string | null;
  priority: "Tinggi" | "Sedang" | "Rendah";
}

interface ForecastSummary {
  total_products: number;
  need_restock: number;
  critical_count: number;
  avg_days_of_cover: number;
  estimated_restock_value_idr: number;
}

const formatISODate = (iso: string) => {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatIDRInput = (value: number) =>
  value ? value.toLocaleString("id-ID") : "";
const parseIDRInput = (value: string) => Number(value.replace(/\D/g, "")) || 0;

export default function BranchInventory() {
  const { id } = useParams();
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStock, setFilterStock] = useState("all");
  const [filterMovement, setFilterMovement] = useState("all");
  const [activeTab, setActiveTab] = useState<
    "inventory" | "movement" | "forecast"
  >("inventory");
  const [forecastHorizon, setForecastHorizon] = useState(14);
  const [forecastFilter, setForecastFilter] = useState("all");

  // Data State
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [stockMovements, setStockMovements] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Forecast State
  const [forecastItems, setForecastItems] = useState<ForecastItem[]>([]);
  const [forecastSummary, setForecastSummary] =
    useState<ForecastSummary | null>(null);
  const [forecastLoading, setForecastLoading] = useState(true);

  // Pagination State
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchProductsAndMovements = async () => {
    setIsLoading(true);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");

      const [productsRes, movementsRes] = await Promise.all([
        fetch(`/api/branches/${id}/products`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`/api/branches/${id}/movements`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(data.data || []);
      }

      if (movementsRes.ok) {
        const data = await movementsRes.json();
        setStockMovements(data.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProductsAndMovements();
  }, [id]);

  const fetchForecast = async () => {
    setForecastLoading(true);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(
        `/api/branches/${id}/forecast?days=${forecastHorizon}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setForecastItems(data.items || []);
        setForecastSummary(data.summary || null);
      }
    } catch (err) {
      console.error("Failed to fetch stock forecast", err);
    } finally {
      setForecastLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchForecast();
    }
  }, [id, forecastHorizon]);

  // Product form modal state
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [productToEdit, setProductToEdit] = useState<InventoryProduct | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSkuScannerOpen, setIsSkuScannerOpen] = useState(false);
  const [skuScannerError, setSkuScannerError] = useState("");
  const [skuCameraFacing, setSkuCameraFacing] = useState<"environment" | "user">(
    "environment",
  );
  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    cost_price_idr: 0,
    selling_price_idr: 0,
    low_stock_threshold: 10,
    initial_stock: 0,
  });

  const openAddProductModal = () => {
    setProductToEdit(null);
    setIsSkuScannerOpen(false);
    setSkuCameraFacing("environment");
    setFormData({
      name: "",
      sku: "",
      cost_price_idr: 0,
      selling_price_idr: 0,
      low_stock_threshold: 10,
      initial_stock: 0,
    });
    setIsAddProductOpen(true);
  };

  const openEditProductModal = (product: InventoryProduct) => {
    setProductToEdit(product);
    setIsSkuScannerOpen(false);
    setFormData({
      name: product.name,
      sku: product.sku,
      cost_price_idr: product.cost_price_idr ?? 0,
      selling_price_idr: product.selling_price_idr ?? 0,
      low_stock_threshold: product.low_stock_threshold ?? 0,
      initial_stock: 0,
    });
    setIsAddProductOpen(true);
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      const isEditing = Boolean(productToEdit);
      const res = await fetch(
        isEditing
          ? `/api/branches/${id}/products/${productToEdit?.product_id}`
          : `/api/branches/${id}/products`,
        {
          method: isEditing ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(
            isEditing
              ? {
                  name: formData.name,
                  sku: formData.sku,
                  cost_price_idr: formData.cost_price_idr,
                  selling_price_idr: formData.selling_price_idr,
                  low_stock_threshold: formData.low_stock_threshold,
                }
              : formData,
          ),
        },
      );
      if (res.ok) {
        setIsAddProductOpen(false);
        setProductToEdit(null);
        setFormData({
          name: "",
          sku: "",
          cost_price_idr: 0,
          selling_price_idr: 0,
          low_stock_threshold: 10,
          initial_stock: 0,
        });
        fetchProductsAndMovements(); // Refresh data
        toast.success(
          isEditing
            ? "Produk berhasil diperbarui!"
            : "Produk berhasil ditambahkan!",
        );
      } else {
        const data = await res.json();
        toast.error(
          data.error ||
            (isEditing
              ? "Gagal memperbarui produk"
              : "Gagal menambahkan produk"),
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Movement Modal State (Per Item)
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementProduct, setMovementProduct] = useState<any>(null);
  const [movementType, setMovementType] = useState<"in" | "out">("in");
  const [movementForm, setMovementForm] = useState({
    qty_change: 1,
    reason: "restock", // default
  });

  // Global Adjustment Modal State
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [adjForm, setAdjForm] = useState({
    product_id: "",
    qty_change: 0,
    reason: "adjustment",
  });
  const [adjSearchQuery, setAdjSearchQuery] = useState("");
  const [isAdjDropdownOpen, setIsAdjDropdownOpen] = useState(false);

  const filteredAdjProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(adjSearchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(adjSearchQuery.toLowerCase()),
  );

  const handleAdjSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjForm.product_id || adjForm.qty_change === 0) {
      toast.error(
        "Pilih produk dan masukkan jumlah penyesuaian yang valid (tidak nol).",
      );
      return;
    }

    // Validasi stok minus
    const product = products.find((p) => p.product_id === adjForm.product_id);
    if (
      adjForm.qty_change < 0 &&
      product &&
      product.current_stock + adjForm.qty_change < 0
    ) {
      toast.error("Jumlah pengurangan melebihi stok yang tersedia.");
      return;
    }

    setIsSubmitting(true);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");

      const payload = {
        qty_change: adjForm.qty_change,
        reason: adjForm.reason,
      };

      const res = await fetch(
        `/api/branches/${id}/products/${adjForm.product_id}/movement`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (res.ok) {
        setIsAdjModalOpen(false);
        setAdjForm({ product_id: "", qty_change: 0, reason: "adjustment" });
        setAdjSearchQuery("");
        fetchProductsAndMovements();
        toast.success("Penyesuaian stok berhasil dicatat!");
      } else {
        const data = await res.json();
        toast.error(data.error || "Gagal mencatat penyesuaian stok");
      }
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenMovementModal = (product: any, type: "in" | "out") => {
    setMovementProduct(product);
    setMovementType(type);
    setMovementForm({
      qty_change: 1,
      reason: type === "in" ? "restock" : "sale",
    });
    setIsMovementModalOpen(true);
  };

  const handleMovementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!movementProduct) return;

    setIsSubmitting(true);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      // For type 'out', quantity change should be negative
      const qty =
        movementType === "in"
          ? Math.abs(movementForm.qty_change)
          : -Math.abs(movementForm.qty_change);

      const payload = {
        qty_change: qty,
        reason: movementForm.reason,
      };

      const res = await fetch(
        `/api/branches/${id}/products/${movementProduct.product_id}/movement`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        },
      );

      if (res.ok) {
        setIsMovementModalOpen(false);
        fetchProductsAndMovements(); // Refresh products to get updated stock
        toast.success("Pergerakan stok berhasil dicatat!");
      } else {
        const data = await res.json();
        toast.error(data.error || "Gagal mencatat pergerakan stok");
      }
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] =
    useState<InventoryProduct | null>(null);

  const handleDeleteProductClick = (product: InventoryProduct) => {
    setProductToDelete(product);
    setIsDeleteModalOpen(true);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    setIsSubmitting(true);
    try {
      const token =
        localStorage.getItem("token") || sessionStorage.getItem("token");
      const res = await fetch(
        `/api/branches/${id}/products/${productToDelete.product_id}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        toast.success("Produk berhasil dihapus");
        setIsDeleteModalOpen(false);
        setProductToDelete(null);
        fetchProductsAndMovements();
      } else {
        const data = await res.json();
        toast.error(data.error || "Gagal menghapus produk");
      }
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan jaringan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Derived state for pagination and filtering
  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      filterStock === "all"
        ? true
        : filterStock === "safe"
          ? p.status === "Aman"
          : filterStock === "low"
            ? p.status === "Menipis"
            : p.status === "Habis";
    return matchesSearch && matchesStatus;
  });

  const filteredMovements = stockMovements.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      filterMovement === "all" ? true : filterMovement === m.type;
    return matchesSearch && matchesStatus;
  });

  const filteredForecast = forecastItems.filter((f) => {
    const matchesSearch =
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.sku.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority =
      forecastFilter === "all" ? true : f.priority === forecastFilter;
    return matchesSearch && matchesPriority;
  });

  const restockCount = forecastSummary?.need_restock ?? 0;
  const criticalCount = forecastSummary?.critical_count ?? 0;
  const avgDaysLeft = forecastSummary?.avg_days_of_cover ?? 0;
  const restockValue = forecastSummary?.estimated_restock_value_idr ?? 0;

  const totalItems =
    activeTab === "inventory"
      ? filteredProducts.length
      : activeTab === "movement"
        ? filteredMovements.length
        : filteredForecast.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );
  const paginatedMovements = filteredMovements.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );
  const paginatedForecast = filteredForecast.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  const lowCount = products.filter((p) => p.status === "Menipis").length;
  const outCount = products.filter((p) => p.status === "Habis").length;
  const unitsOnHand = products.reduce(
    (sum, product) => sum + (product.current_stock || 0),
    0,
  );
  const inventoryValue = products.reduce(
    (sum, product) =>
      sum + (product.current_stock || 0) * (product.cost_price_idr || 0),
    0,
  );

  return (
    <div className="space-y-5 text-slate-900">
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm">
            <span className="font-medium text-[#21AC3A]">Cabang</span>
            <span className="text-slate-400">/</span>
            <span className="text-slate-500">Inventori &amp; Stok</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
            Inventori &amp; Stok
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {products.length} produk · Pantau ketersediaan dan pergerakan stok
            cabang.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAdjModalOpen(true)}
            className="inline-flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <ArrowUpDown className="h-4 w-4" />
            Sesuaikan stok
          </button>
          <button
            onClick={openAddProductModal}
            className="inline-flex items-center gap-2 border border-[#21AC3A] bg-[#21AC3A] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#1d9732]"
          >
            <Plus className="h-4 w-4" />
            Tambah produk
          </button>
        </div>
      </div>

      {activeTab === "forecast" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Perlu restock",
              value: String(restockCount),
              icon: <PackagePlus className="h-4 w-4" />,
              note: "Rekomendasi berdasarkan prediksi",
              color: "text-[#21AC3A]",
            },
            {
              label: "Prediksi habis ≤7 hari",
              value: String(criticalCount),
              icon: <CalendarClock className="h-4 w-4" />,
              note: "Produk berisiko kritis",
              color: "text-amber-600",
            },
            {
              label: "Rata-rata hari tersisa",
              value: `${avgDaysLeft} hari`,
              icon: <Timer className="h-4 w-4" />,
              note: "Cakupan stok saat ini",
              color: "text-[#21AC3A]",
            },
            {
              label: "Estimasi nilai restock",
              value: `Rp ${restockValue.toLocaleString("id-ID")}`,
              icon: <Boxes className="h-4 w-4" />,
              note: "Perkiraan biaya pengadaan",
              color: "text-[#16852A]",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex min-h-24 flex-col justify-between border border-slate-300 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
                <span>{stat.label}</span>
                <span className={stat.color}>{stat.icon}</span>
              </div>
              <div className="mt-3 flex items-end justify-between gap-2">
                <span className="text-2xl font-semibold tracking-tight text-slate-900">
                  {stat.value}
                </span>
                <span className="text-right text-xs text-slate-500">
                  {stat.note}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: "Produk",
              value: String(products.length),
              icon: <BoxSelect className="h-4 w-4" />,
              note: "SKU terdaftar",
              color: "text-[#21AC3A]",
            },
            {
              label: "Unit tersedia",
              value: unitsOnHand.toLocaleString("id-ID"),
              icon: <PackageCheck className="h-4 w-4" />,
              note: `Di ${products.length} produk`,
              color: "text-[#21AC3A]",
            },
            {
              label: "Stok menipis",
              value: String(lowCount),
              icon: <AlertCircle className="h-4 w-4" />,
              note: `${outCount} produk habis`,
              color: "text-amber-600",
            },
            {
              label: "Nilai persediaan",
              value: `Rp ${inventoryValue.toLocaleString("id-ID")}`,
              icon: <PackageOpen className="h-4 w-4" />,
              note: "Berdasarkan harga modal",
              color: "text-[#16852A]",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex min-h-24 flex-col justify-between border border-slate-300 bg-white p-4"
            >
              <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
                <span>{stat.label}</span>
                <span className={stat.color}>{stat.icon}</span>
              </div>
              <div className="mt-3 flex items-end justify-between gap-2">
                <span className="text-2xl font-semibold tracking-tight text-slate-900">
                  {stat.value}
                </span>
                <span className="text-right text-xs text-slate-500">
                  {stat.note}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <section className="overflow-hidden border border-slate-300 bg-white">
        <div className="flex flex-col justify-between gap-3 border-b border-slate-300 px-4 py-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              {activeTab === "inventory"
                ? "Daftar persediaan"
                : activeTab === "movement"
                  ? "Riwayat pergerakan"
                  : "Prediksi stok"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {activeTab === "inventory"
                ? "Pantau jumlah, nilai, dan status stok produk."
                : activeTab === "movement"
                  ? "Catatan barang masuk, keluar, dan penyesuaian."
                  : "Perkiraan kebutuhan stok berdasarkan riwayat penjualan."}
            </p>
          </div>
          <div className="flex items-center gap-1 border border-slate-300 p-1 text-sm">
            {(
              [
                ["inventory", "Inventori"],
                ["movement", "Pergerakan"],
                ["forecast", "Forecast"],
              ] as const
            ).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 font-medium transition-colors ${activeTab === tab ? "bg-green-50 text-[#16852A]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 border-b border-slate-300 px-3 py-2.5 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama produk atau SKU"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm outline-none transition-colors focus:border-[#21AC3A]"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === "forecast" && (
              <div className="flex items-center gap-1 border border-slate-300 bg-white p-1 text-sm">
                <span className="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Horizon
                </span>
                {[7, 14, 30].map((h) => (
                  <button
                    key={h}
                    onClick={() => {
                      setForecastHorizon(h);
                      setCurrentPage(1);
                    }}
                    className={`px-3 py-1 font-semibold transition-colors ${forecastHorizon === h ? "bg-[#21AC3A] text-white" : "text-slate-600 hover:bg-slate-100"}`}
                  >
                    {h} hari
                  </button>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2 border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
              <Filter className="w-4 h-4 text-slate-400" />
              {activeTab === "inventory" ? (
                <select
                  className="bg-transparent outline-none cursor-pointer"
                  value={filterStock}
                  onChange={(e) => {
                    setFilterStock(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="all">Semua Status</option>
                  <option value="safe">Aman</option>
                  <option value="low">Menipis</option>
                  <option value="out">Habis</option>
                </select>
              ) : activeTab === "movement" ? (
                <select
                  className="bg-transparent outline-none cursor-pointer"
                  value={filterMovement}
                  onChange={(e) => {
                    setFilterMovement(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="all">Semua Pergerakan</option>
                  <option value="in">Barang Masuk</option>
                  <option value="out">Barang Keluar</option>
                  <option value="adj">Penyesuaian (Minus)</option>
                </select>
              ) : (
                <select
                  className="bg-transparent outline-none cursor-pointer"
                  value={forecastFilter}
                  onChange={(e) => {
                    setForecastFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                >
                  <option value="all">Semua Prioritas</option>
                  <option value="Tinggi">Prioritas Tinggi</option>
                  <option value="Sedang">Prioritas Sedang</option>
                  <option value="Rendah">Prioritas Rendah</option>
                </select>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setFilterStock("all");
                setFilterMovement("all");
                setForecastFilter("all");
                setCurrentPage(1);
              }}
              className="px-2 py-2 text-sm font-semibold text-slate-700 hover:text-[#21AC3A]"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          {activeTab === "inventory" ? (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="border-b border-slate-300 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Produk</th>
                  <th className="px-3 py-2.5 font-semibold">SKU</th>
                  <th className="px-3 py-2.5 font-semibold">Harga Jual</th>
                  <th className="px-3 py-2.5 font-semibold">Sisa Stok</th>
                  <th className="px-3 py-2.5 font-semibold">Batas Minimum</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-10 text-center text-slate-500"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-[#21AC3A] mb-2" />
                        <p>Memuat data inventori...</p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-10 text-center text-slate-500"
                    >
                      Belum ada data produk atau tidak ada yang sesuai dengan
                      filter.
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((product) => (
                    <motion.tr
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      key={product.id}
                      className="hover:bg-slate-50/50 transition-colors"
                    >
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-slate-900">
                          {product.name}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500 font-medium">
                        {product.sku}
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-slate-700">
                        Rp {product.selling_price_idr?.toLocaleString("id-ID")}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="font-bold text-slate-900">
                          {product.current_stock}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">
                        {product.low_stock_threshold}
                      </td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                            product.status === "Aman"
                              ? "bg-emerald-100 text-emerald-700"
                              : product.status === "Menipis"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {product.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditProductModal(product)}
                            aria-label={`Edit informasi ${product.name}`}
                            title="Edit produk"
                            className="inline-flex min-h-10 min-w-10 items-center justify-center border border-slate-300 bg-white p-2 text-slate-600 transition-colors hover:border-[#21AC3A] hover:bg-green-50 hover:text-[#16852A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#21AC3A] focus-visible:ring-offset-1"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              handleOpenMovementModal(product, "in")
                            }
                            aria-label={`Catat stok masuk untuk ${product.name}`}
                            title="Tambah stok"
                            className="inline-flex min-h-10 items-center justify-center gap-1.5 border border-green-200 bg-green-50 px-2.5 text-xs font-semibold text-[#16852A] transition-colors hover:border-[#21AC3A] hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#21AC3A] focus-visible:ring-offset-1"
                          >
                            <ArrowDownToLine className="h-4 w-4" />
                            <span>Stok masuk</span>
                          </button>
                          <button
                            onClick={() =>
                              handleOpenMovementModal(product, "out")
                            }
                            aria-label={`Catat stok keluar untuk ${product.name}`}
                            title="Kurangi stok"
                            className="inline-flex min-h-10 items-center justify-center gap-1.5 border border-amber-200 bg-amber-50 px-2.5 text-xs font-semibold text-amber-800 transition-colors hover:border-amber-400 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-1"
                          >
                            <ArrowUpFromLine className="h-4 w-4" />
                            <span>Stok keluar</span>
                          </button>
                          <button
                            onClick={() => handleDeleteProductClick(product)}
                            aria-label={`Hapus ${product.name}`}
                            title="Hapus produk"
                            className="inline-flex min-h-10 min-w-10 items-center justify-center border border-slate-300 bg-white p-2 text-slate-500 transition-colors hover:border-red-300 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          ) : activeTab === "movement" ? (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="border-b border-slate-300 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Tanggal & Waktu</th>
                  <th className="px-3 py-2.5 font-semibold">Produk</th>
                  <th className="px-3 py-2.5 font-semibold">Pergerakan</th>
                  <th className="px-3 py-2.5 font-semibold">Keterangan</th>
                  <th className="px-3 py-2.5 font-semibold">Dibuat Oleh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedMovements.map((movement) => (
                  <motion.tr
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    key={movement.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-3 py-2.5 text-slate-500 font-medium">
                      {movement.date}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="font-semibold text-slate-900">
                        {movement.name}
                      </p>
                      <p className="text-xs text-slate-500">{movement.sku}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <div
                        className={`inline-flex items-center gap-1.5 font-bold ${
                          movement.type === "in"
                            ? "text-emerald-600"
                            : movement.type === "out"
                              ? "text-amber-600"
                              : "text-red-600"
                        }`}
                      >
                        {movement.type === "in" ? (
                          <ArrowDownToLine className="w-4 h-4" />
                        ) : movement.type === "out" ? (
                          <ArrowUpFromLine className="w-4 h-4" />
                        ) : (
                          <ArrowUpDown className="w-4 h-4" />
                        )}
                        <span>
                          {movement.type === "in"
                            ? "+"
                            : movement.type === "out"
                              ? "-"
                              : ""}
                          {Math.abs(movement.qty)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">
                      {movement.reason}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {movement.user}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="border-b border-slate-300 bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Produk</th>
                  <th className="px-3 py-2.5 font-semibold">Stok Saat Ini</th>
                  <th className="px-3 py-2.5 font-semibold">
                    Permintaan / Hari
                  </th>
                  <th className="px-3 py-2.5 font-semibold">Estimasi Habis</th>
                  <th className="px-3 py-2.5 font-semibold">Hari Tersisa</th>
                  <th className="px-3 py-2.5 font-semibold">
                    Rekomendasi Restock
                  </th>
                  <th className="px-3 py-2.5 font-semibold">Prioritas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {forecastLoading ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-10 text-center text-slate-500"
                    >
                      <div className="flex flex-col items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-[#21AC3A] mb-2" />
                        <p>Menghitung prediksi stok...</p>
                      </div>
                    </td>
                  </tr>
                ) : paginatedForecast.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-10 text-center text-slate-500"
                    >
                      Belum ada produk untuk diprediksi atau tidak ada yang
                      sesuai dengan filter.
                    </td>
                  </tr>
                ) : (
                  paginatedForecast.map((f) => {
                    const cover = f.days_of_cover;
                    const stockout = f.estimated_stockout_date;
                    const coverage =
                      cover !== null
                        ? Math.max(
                            4,
                            Math.min(
                              100,
                              Math.round((cover / forecastHorizon) * 100),
                            ),
                          )
                        : 100;
                    const barColor =
                      f.priority === "Tinggi"
                        ? "bg-red-500"
                        : f.priority === "Sedang"
                          ? "bg-amber-500"
                          : "bg-emerald-500";
                    const textColor =
                      f.priority === "Tinggi"
                        ? "text-red-600"
                        : f.priority === "Sedang"
                          ? "text-amber-600"
                          : "text-emerald-600";
                    const badgeColor =
                      f.priority === "Tinggi"
                        ? "bg-red-100 text-red-700"
                        : f.priority === "Sedang"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-emerald-100 text-emerald-700";
                    return (
                      <motion.tr
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        key={f.product_id}
                        className="hover:bg-slate-50/50 transition-colors"
                      >
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-slate-900">
                            {f.name}
                          </p>
                          <p className="text-xs text-slate-500">{f.sku}</p>
                        </td>
                        <td className="px-3 py-2.5">
                          <span className="font-bold text-slate-900">
                            {f.current_stock}
                          </span>
                          <span className="text-xs text-slate-400">
                            {" "}
                            / min {f.low_stock_threshold}
                          </span>
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="font-semibold text-slate-700">
                            {f.smoothed_daily_demand.toFixed(1)} unit
                          </p>
                        </td>
                        <td className="px-3 py-2.5">
                          {cover !== null && stockout ? (
                            <>
                              <p className="font-medium text-slate-700">
                                {formatISODate(stockout)}
                              </p>
                              <p
                                className={`text-xs font-semibold ${textColor}`}
                              >
                                {cover < 1
                                  ? "dalam kurang dari 1 hari"
                                  : `dalam ${Math.floor(cover)} hari`}
                              </p>
                            </>
                          ) : (
                            <span className="text-slate-400">
                              Tidak ada permintaan
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${barColor}`}
                                style={{ width: `${coverage}%` }}
                              />
                            </div>
                            <span className={`text-xs font-bold ${textColor}`}>
                              {cover !== null ? `${Math.floor(cover)}h` : "∞"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          {f.recommended_reorder_qty > 0 ? (
                            <p className="font-bold text-[#21AC3A]">
                              +{f.recommended_reorder_qty} unit
                            </p>
                          ) : (
                            <span className="text-xs font-medium text-slate-400">
                              Cukup
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${badgeColor}`}
                          >
                            {f.priority}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-300 px-3 py-3 text-sm text-slate-500 sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="whitespace-nowrap">Tampilkan:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(Number(e.target.value));
                setCurrentPage(1); // Reset page on limit change
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-[#21AC3A]"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span className="whitespace-nowrap ml-2">
              Menampilkan{" "}
              {activeTab === "inventory"
                ? paginatedProducts.length
                : activeTab === "movement"
                  ? paginatedMovements.length
                  : paginatedForecast.length}{" "}
              dari {totalItems} data
            </span>
          </div>

          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Sebelumnya
            </button>
            <button className="px-3 py-1 bg-[#21AC3A] text-white rounded">
              {currentPage}
            </button>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="px-3 py-1 border border-slate-200 rounded hover:bg-slate-50 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </section>

      {/* Add Product Modal */}
      {isAddProductOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => !isSubmitting && setIsAddProductOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-2xl bg-white border border-slate-300 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            <div className="p-5 border-b border-slate-300 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {productToEdit
                    ? "Edit Informasi Produk"
                    : "Tambah Produk Baru"}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {productToEdit
                    ? "Perbarui informasi produk. Perubahan berlaku di seluruh cabang bisnis."
                    : "Tambahkan produk ke dalam katalog master dan set stok awal cabang."}
                </p>
              </div>
              <button
                onClick={() => !isSubmitting && setIsAddProductOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100  transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              <form
                id="add-product-form"
                onSubmit={handleAddProduct}
                className="space-y-5"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700">
                      Nama Produk
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={255}
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20"
                      placeholder="Contoh: Indomie Goreng Special"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <label
                        htmlFor="product-sku"
                        className="text-sm font-semibold text-slate-700"
                      >
                        SKU (Stock Keeping Unit)
                      </label>
                      {!productToEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsSkuScannerOpen((open) => !open);
                            setSkuScannerError("");
                          }}
                          aria-expanded={isSkuScannerOpen}
                          className="inline-flex min-h-8 items-center gap-1.5 px-2 text-xs font-semibold text-[#16852A] hover:bg-[#EAF7EC] transition-colors"
                        >
                          <ScanLine className="h-4 w-4" />
                          {isSkuScannerOpen ? "Tutup scanner" : "Scan barcode"}
                        </button>
                      )}
                    </div>
                    <input
                      id="product-sku"
                      type="text"
                      required
                      maxLength={100}
                      value={formData.sku}
                      onChange={(e) =>
                        setFormData({ ...formData, sku: e.target.value })
                      }
                      className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20"
                      placeholder="Contoh: SKU-001"
                    />
                    {isSkuScannerOpen && !productToEdit && (
                      <div className="overflow-hidden border border-slate-200 bg-slate-950">
                        <Scanner
                          onScan={(codes) => {
                            const barcode = codes[0]?.rawValue?.trim();
                            if (!barcode) return;
                            setFormData((current) => ({
                              ...current,
                              sku: barcode,
                            }));
                            setIsSkuScannerOpen(false);
                            setSkuScannerError("");
                            toast.success(
                              "Barcode berhasil dimasukkan ke SKU.",
                            );
                          }}
                          onError={(error) => setSkuScannerError(error.message)}
                          constraints={{
                            facingMode: { ideal: skuCameraFacing },
                          }}
                          formats={[
                            "code_128",
                            "code_39",
                            "ean_13",
                            "ean_8",
                            "upc_a",
                            "upc_e",
                            "itf",
                            "qr_code",
                          ]}
                          allowMultiple={true}
                          scanDelay={2000}
                          styles={{
                            container: { width: "100%", minHeight: "240px" },
                            video: {
                              width: "100%",
                              minHeight: "240px",
                              objectFit: "cover",
                            },
                          }}
                        />
                        {skuScannerError && (
                          <p
                            role="alert"
                            className="bg-red-50 px-3 py-2 text-xs text-red-700"
                          >
                            Kamera tidak dapat digunakan: {skuScannerError}.
                            Pastikan izin kamera aktif dan halaman dibuka
                            melalui HTTPS atau localhost.
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-3 bg-slate-50 px-3 py-2">
                          <p className="text-xs text-slate-500">
                            Arahkan kamera {skuCameraFacing === "environment" ? "belakang" : "depan"} ke barcode produk.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setSkuCameraFacing((current) =>
                                current === "environment" ? "user" : "environment",
                              );
                              setSkuScannerError("");
                            }}
                            aria-label={`Ganti ke kamera ${skuCameraFacing === "environment" ? "depan" : "belakang"}`}
                            className="inline-flex shrink-0 items-center gap-1.5 border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Kamera {skuCameraFacing === "environment" ? "depan" : "belakang"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {!productToEdit && (
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">
                        Stok Awal Cabang
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.initial_stock || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            initial_stock: parseInt(e.target.value) || 0,
                          })
                        }
                        className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20"
                        placeholder="0"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                      Harga Modal (Rp)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={formatIDRInput(formData.cost_price_idr)}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          cost_price_idr: parseIDRInput(e.target.value),
                        })
                      }
                      className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20"
                      placeholder="3.000"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-slate-700">
                      Harga Jual (Rp)
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      required
                      value={formatIDRInput(formData.selling_price_idr)}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          selling_price_idr: parseIDRInput(e.target.value),
                        })
                      }
                      className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20"
                      placeholder="3.500"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                      Batas Minimum Stok (Peringatan Stok Menipis)
                      <AlertCircle className="w-4 h-4 text-amber-500" />
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={formData.low_stock_threshold}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          low_stock_threshold: parseInt(e.target.value) || 0,
                        })
                      }
                      className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20"
                      placeholder="10"
                    />
                  </div>
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-slate-300 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsAddProductOpen(false)}
                disabled={isSubmitting}
                className="min-h-10 px-4 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50  transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                form="add-product-form"
                disabled={isSubmitting}
                className="min-h-10 px-4 py-2.5 text-sm font-bold text-white bg-[#21AC3A] hover:bg-[#1d9732]  transition-colors  flex items-center gap-2 cursor-pointer disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : productToEdit ? (
                  "Simpan Perubahan"
                ) : (
                  "Simpan Produk"
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Stock Movement Modal */}
      {isMovementModalOpen && movementProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => !isSubmitting && setIsMovementModalOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-lg bg-white border border-slate-300 shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-5 border-b border-slate-300 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {movementType === "in"
                    ? "Catat Barang Masuk"
                    : "Catat Barang Keluar"}
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Produk:{" "}
                  <span className="font-semibold text-slate-800">
                    {movementProduct.name} ({movementProduct.sku})
                  </span>
                </p>
                <p className="text-sm text-slate-500">
                  Sisa Stok Saat Ini:{" "}
                  <span className="font-semibold text-slate-800">
                    {movementProduct.current_stock}
                  </span>
                </p>
              </div>
              <button
                onClick={() => !isSubmitting && setIsMovementModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100  transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              <form
                id="movement-form"
                onSubmit={handleMovementSubmit}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Jumlah (Qty)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={
                      movementType === "out"
                        ? movementProduct.current_stock
                        : undefined
                    }
                    required
                    value={movementForm.qty_change || ""}
                    onChange={(e) =>
                      setMovementForm({
                        ...movementForm,
                        qty_change: parseInt(e.target.value) || 0,
                      })
                    }
                    className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20"
                    placeholder="Contoh: 10"
                  />
                  {movementType === "out" && (
                    <p className="text-xs text-amber-600">
                      Jumlah maksimum yang dapat dikeluarkan adalah{" "}
                      {movementProduct.current_stock}.
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Alasan / Keterangan
                  </label>
                  <select
                    required
                    value={movementForm.reason}
                    onChange={(e) =>
                      setMovementForm({
                        ...movementForm,
                        reason: e.target.value,
                      })
                    }
                    className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20"
                  >
                    {movementType === "in" ? (
                      <>
                        <option value="restock">Restock / Pembelian</option>
                        <option value="return">Retur dari Pelanggan</option>
                        <option value="adjustment">
                          Penyesuaian Stok (Plus)
                        </option>
                      </>
                    ) : (
                      <>
                        <option value="sale">Penjualan</option>
                        <option value="return">Retur ke Supplier</option>
                        <option value="adjustment">
                          Barang Rusak / Hilang (Minus)
                        </option>
                      </>
                    )}
                  </select>
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-slate-300 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsMovementModalOpen(false)}
                disabled={isSubmitting}
                className="min-h-10 px-4 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50  transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                form="movement-form"
                disabled={
                  isSubmitting ||
                  movementForm.qty_change <= 0 ||
                  (movementType === "out" &&
                    movementForm.qty_change > movementProduct.current_stock)
                }
                className={`min-h-10 px-4 py-2.5 text-sm font-bold text-white  transition-colors shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-70 ${
                  movementType === "in"
                    ? "bg-[#21AC3A] hover:bg-[#1d9732] shadow-[#21AC3A]/20"
                    : "bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : movementType === "in" ? (
                  "Tambah Stok"
                ) : (
                  "Kurangi Stok"
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Global Stock Adjustment Modal */}
      {isAdjModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => !isSubmitting && setIsAdjModalOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-lg bg-white border border-slate-300 shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-5 border-b border-slate-300 flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Penyesuaian Stok Global
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Pilih produk dan masukkan jumlah penyesuaian (bisa positif
                  atau negatif).
                </p>
              </div>
              <button
                onClick={() => !isSubmitting && setIsAdjModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100  transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto">
              <form
                id="adj-form"
                onSubmit={handleAdjSubmit}
                className="space-y-5"
              >
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Pilih Produk
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Ketik nama produk atau SKU..."
                      value={adjSearchQuery}
                      onChange={(e) => {
                        setAdjSearchQuery(e.target.value);
                        setIsAdjDropdownOpen(true);
                        // Reset selected product if user types something new
                        if (adjForm.product_id) {
                          setAdjForm({ ...adjForm, product_id: "" });
                        }
                      }}
                      onFocus={() => setIsAdjDropdownOpen(true)}
                      className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20"
                    />

                    {isAdjDropdownOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setIsAdjDropdownOpen(false)}
                        />
                        <div className="absolute z-20 w-full mt-2 bg-white border border-slate-200  shadow-lg max-h-60 overflow-y-auto">
                          {filteredAdjProducts.length > 0 ? (
                            <ul className="py-2">
                              {filteredAdjProducts.map((p) => (
                                <li
                                  key={p.product_id}
                                  className={`px-4 py-2 cursor-pointer relative z-30 hover:bg-slate-50 ${adjForm.product_id === p.product_id ? "bg-[#21AC3A]/10 text-[#21AC3A]" : "text-slate-700"}`}
                                  onClick={() => {
                                    setAdjForm({
                                      ...adjForm,
                                      product_id: p.product_id,
                                    });
                                    setAdjSearchQuery(
                                      `${p.name} (SKU: ${p.sku})`,
                                    );
                                    setIsAdjDropdownOpen(false);
                                  }}
                                >
                                  <div className="font-medium">{p.name}</div>
                                  <div className="text-xs text-slate-500">
                                    SKU: {p.sku} • Sisa Stok:{" "}
                                    <span className="font-bold">
                                      {p.current_stock}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <div className="px-4 py-3 text-sm text-slate-500 text-center">
                              Produk tidak ditemukan
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Jumlah Penyesuaian (+ / -)
                  </label>
                  <input
                    type="number"
                    required
                    value={adjForm.qty_change}
                    onChange={(e) =>
                      setAdjForm({
                        ...adjForm,
                        qty_change: parseInt(e.target.value) || 0,
                      })
                    }
                    className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20"
                    placeholder="Contoh: 10 atau -5"
                  />
                  <p className="text-xs text-slate-500">
                    Gunakan tanda minus (-) untuk mengurangi stok, atau angka
                    biasa untuk menambah stok.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">
                    Alasan / Keterangan
                  </label>
                  <input
                    type="text"
                    required
                    value={adjForm.reason}
                    onChange={(e) =>
                      setAdjForm({ ...adjForm, reason: e.target.value })
                    }
                    className="min-h-11 w-full border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-[#21AC3A] focus:ring-2 focus:ring-[#21AC3A]/20"
                    placeholder="Contoh: Barang Rusak, Salah Hitung"
                  />
                </div>
              </form>
            </div>

            <div className="p-4 border-t border-slate-300 bg-slate-50 flex justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setIsAdjModalOpen(false)}
                disabled={isSubmitting}
                className="min-h-10 px-4 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50  transition-colors cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                form="adj-form"
                disabled={
                  isSubmitting ||
                  !adjForm.product_id ||
                  adjForm.qty_change === 0
                }
                className="min-h-10 px-4 py-2.5 text-sm font-bold text-white bg-[#21AC3A] hover:bg-[#1d9732]  transition-colors  flex items-center gap-2 cursor-pointer disabled:opacity-70"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  "Simpan Penyesuaian"
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => !isSubmitting && setIsDeleteModalOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md bg-white border border-slate-300 shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="p-5 text-center">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 mb-2">
                Hapus Produk?
              </h2>
              <p className="text-sm text-slate-500 mb-6">
                Apakah Anda yakin ingin menghapus{" "}
                <span className="font-semibold text-slate-800">
                  {productToDelete.name}
                </span>
                ? Tindakan ini akan menghapus produk dari inventori, tetapi
                riwayat pergerakan stok tetap akan disimpan.
              </p>

              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  disabled={isSubmitting}
                  className="min-h-10 px-4 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50  transition-colors cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteProduct}
                  disabled={isSubmitting}
                  className="min-h-10 px-4 py-2.5 text-sm font-bold text-white bg-red-600 hover:bg-red-700  transition-colors  flex items-center gap-2 cursor-pointer disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Menghapus...
                    </>
                  ) : (
                    "Ya, Hapus Produk"
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
