import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Scanner } from '@yudiel/react-qr-scanner';
import toast from 'react-hot-toast';
import {
  Search,
  ShoppingCart,
  Trash2,
  ScanLine,
  User,
  Plus,
  Minus,
  X,
  CreditCard,
  Delete,
  Check,
  Download,
  RefreshCw,
} from 'lucide-react';
import { useParams } from 'react-router-dom';

interface Product {
  id: string;
  name: string;
  sku: string;
  selling_price_idr: number;
  current_stock: number;
  image?: string;
}

interface ProductResponse {
  product_id: string;
  name: string;
  sku: string;
  selling_price_idr: number;
  current_stock?: number;
}


interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  discount: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
}

interface Order {
  id: string;
  order_number: string;
  total_amount_idr: number;
  payment_method: string;
  payment_status: string;
  created_at: string;
  items_count: number;
}

type PaymentMethod = 'cash' | 'qris' | 'debit' | 'credit' | 'transfer' | 'ewallet';

const paymentMethods: Array<{ value: PaymentMethod; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'qris', label: 'QRIS' },
  { value: 'debit', label: 'Debit card' },
  { value: 'credit', label: 'Credit card' },
  { value: 'transfer', label: 'Bank transfer' },
  { value: 'ewallet', label: 'E-wallet' },
];

const formatIDR = (amount: number) => `Rp ${Math.round(amount).toLocaleString('id-ID')}`;
const localDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function BranchPOS() {
  const { id: branchId } = useParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [amountPaid, setAmountPaid] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [transactionQuery, setTransactionQuery] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(false);

  const fetchOrders = useCallback(async () => {
    if (!branchId) return;
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const today = localDateKey(new Date());
      const params = new URLSearchParams({ start_date: today, end_date: today });
      const response = await fetch(`/api/branches/${branchId}/reports/sales?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const result = await response.json();
        setOrders(result.orders || []);
      }
    } catch (error) {
      console.error('Failed to fetch transactions', error);
    } finally {
      setOrdersLoading(false);
    }
  }, [branchId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => { void fetchOrders(); });
    return () => window.cancelAnimationFrame(frame);
  }, [fetchOrders]);

  useEffect(() => {
    if (!isCustomerModalOpen || !branchId) return;
    const controller = new AbortController();
    const fetchCustomers = async () => {
      setCustomersLoading(true);
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const params = new URLSearchParams({ q: customerQuery, page: '1', page_size: '100' });
        const response = await fetch(`/api/branches/${branchId}/customers?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (response.ok) {
          const result = await response.json();
          setCustomers(result.data || []);
        }
      } catch (error) {
        if (!controller.signal.aborted) console.error('Failed to fetch customers', error);
      } finally {
        if (!controller.signal.aborted) setCustomersLoading(false);
      }
    };
    void fetchCustomers();
    return () => controller.abort();
  }, [branchId, customerQuery, isCustomerModalOpen]);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const token = localStorage.getItem('token') || sessionStorage.getItem('token');
        const res = await fetch(`/api/branches/${branchId}/products`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const payload: { data?: ProductResponse[] } = data;
          const mappedProducts = (payload.data || []).map((p) => ({
            id: p.product_id,
            name: p.name,
            sku: p.sku,
            selling_price_idr: p.selling_price_idr,
            current_stock: p.current_stock || 0,
          }));
          setProducts(mappedProducts);
        }
      } catch (err) {
        console.error("Failed to fetch products", err);
      }
    };
    if (branchId) {
      fetchProducts();
    }
  }, [branchId]);

  const handlePaymentNumpad = (val: string) => {
    setAmountPaid(prev => {
      if (val === 'DEL') {
        const str = prev.toString();
        return str.length > 1 ? Number(str.slice(0, -1)) : '';
      } else if (val === 'C') {
        return '';
      } else if (val === '+50K') {
        return (Number(prev) || 0) + 50000;
      } else if (val === '+100K') {
        return (Number(prev) || 0) + 100000;
      } else if (val === 'EXACT') {
        return total;
      } else {
        return Number(prev.toString() + val);
      }
    });
  };

  // Filter products based on search
  const filteredProducts = products.filter(p => {
    return p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.sku.toLowerCase().includes(searchQuery.toLowerCase());
  });
  const filteredOrders = orders.filter((order) =>
    order.order_number.toLowerCase().includes(transactionQuery.toLowerCase()) &&
    (paymentFilter === 'all' || order.payment_method.toLowerCase() === paymentFilter),
  );
  const totalToday = orders.reduce((sum, order) => sum + order.total_amount_idr, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);

  const startNewTransaction = () => {
    if (cart.length > 0 && !window.confirm('Clear the current sale and start a new transaction?')) return;
    setCart([]);
    setSelectedCustomer(null);
    setSearchQuery('');
    setAmountPaid('');
  };

  const exportTransactionLog = () => {
    const rows = [
      ['Transaction', 'Time', 'Items', 'Payment', 'Total', 'Status'],
      ...filteredOrders.map((order) => [
        order.order_number,
        new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        order.items_count,
        order.payment_method,
        order.total_amount_idr,
        order.payment_status,
      ]),
    ];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `pos-transactions-${localDateKey(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { id: product.id, name: product.name, price: product.selling_price_idr, qty: 1, discount: 0 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.qty + delta;
        return newQty > 0 ? { ...item, qty: newQty } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
  const totalDiscount = cart.reduce((sum, item) => sum + item.discount, 0);
  const total = subtotal - totalDiscount;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#f5f5f5] pb-20 text-slate-800 md:pb-0">
      <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 lg:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="mb-1 text-sm text-slate-500">Point of sale</div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Point of sale</h1>
            <p className="mt-1 text-sm text-slate-500">Register ready · Sales are recorded automatically</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-2 w-2 rounded-full bg-green-600" />
            POS ready
          </div>
        </div>
      </header>

      <div className="mx-4 mt-4 flex shrink-0 flex-wrap items-center justify-between gap-3 border border-slate-300 bg-white px-4 py-3 lg:mx-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
          <span className="text-slate-600">Sales today:</span>
          <strong className="text-slate-900">{formatIDR(totalToday)}</strong>
          <span className="hidden text-slate-300 sm:inline">|</span>
          <span className="text-slate-500">{orders.length} transactions</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsCustomerModalOpen(true)}
            className={`flex items-center gap-2 border px-3 py-2 text-sm font-semibold transition-colors ${selectedCustomer ? 'border-[#21AC3A] bg-green-50 text-green-800' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            <User className="h-4 w-4" />
            <span className="max-w-[45vw] truncate sm:max-w-none">{selectedCustomer ? selectedCustomer.name : 'Select customer (optional)'}</span>
          </button>
          <button
            type="button"
            onClick={startNewTransaction}
            className="flex items-center gap-2 bg-[#21AC3A] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#1d9732]"
          >
            <Plus className="h-4 w-4" />
            Hold Transaction
          </button>
        </div>
      </div>

      <main className="grid min-h-0 flex-1 grid-cols-1 gap-4 p-4 lg:p-6 xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="order-2 flex h-[60vh] min-h-[360px] flex-col border border-slate-300 bg-white shadow-sm xl:order-1 xl:h-full xl:min-h-115">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-300 px-4 py-3">
            <div>
              <h2 className="font-bold text-slate-900">Transaction log</h2>
              <p className="text-xs text-slate-500">Today’s sales and payment status</p>
            </div>
            <button
              type="button"
              onClick={exportTransactionLog}
              className="flex items-center gap-2 border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              Export log
            </button>
          </div>
          <div className="flex flex-wrap gap-2 border-b border-slate-300 px-3 py-2">
            <div className="relative min-w-55 flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search transaction ID"
                value={transactionQuery}
                onChange={(event) => setTransactionQuery(event.target.value)}
                className="w-full border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#21AC3A]"
              />
            </div>
            <span className="inline-flex items-center border border-slate-300 px-3 text-sm text-slate-600">Today</span>
            <select
              value={paymentFilter}
              onChange={(event) => setPaymentFilter(event.target.value)}
              aria-label="Filter by payment method"
              className="border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#21AC3A]"
            >
              <option value="all">All payments</option>
              <option value="cash">Cash</option>
              <option value="qris">QRIS</option>
              <option value="debit">Debit</option>
              <option value="credit">Credit</option>
              <option value="transfer">Transfer</option>
              <option value="ewallet">E-wallet</option>
            </select>
            <button
              type="button"
              onClick={() => { setOrdersLoading(true); void fetchOrders(); }}
              title="Refresh transactions"
              className="border border-slate-300 px-3 text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="min-w-[620px] w-full border-collapse text-left">
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="border-b border-slate-300 px-3 py-3">Transaction</th>
                  <th className="border-b border-slate-300 px-3 py-3">Time</th>
                  <th className="border-b border-slate-300 px-3 py-3 text-right">Items</th>
                  <th className="border-b border-slate-300 px-3 py-3">Payment</th>
                  <th className="border-b border-slate-300 px-3 py-3 text-right">Total</th>
                  <th className="border-b border-slate-300 px-3 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {ordersLoading ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-slate-500">Loading transactions…</td></tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-14 text-center text-slate-500">
                      {orders.length ? 'No transactions match these filters.' : 'No transactions recorded today yet.'}
                    </td>
                  </tr>
                ) : filteredOrders.map((order, index) => (
                  <tr key={order.id} className={index % 2 ? 'bg-slate-50/70' : 'bg-white'}>
                    <td className="px-3 py-3 font-semibold text-slate-900">{order.order_number}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-slate-500">
                      {new Date(order.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                    </td>
                    <td className="px-3 py-3 text-right text-slate-600">{order.items_count}</td>
                    <td className="px-3 py-3 uppercase text-slate-600">{order.payment_method}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right text-slate-600">{formatIDR(order.total_amount_idr)}</td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${order.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
                        {order.payment_status === 'paid' ? 'Completed' : order.payment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-slate-200 px-3 py-3 text-sm text-slate-500">
            <span>{orders.length} transactions today</span>
            <span>{formatIDR(totalToday)} total sales</span>
          </div>
        </section>

        <aside className="order-1 flex h-[70vh] min-h-[420px] flex-col border border-slate-300 bg-white shadow-sm xl:order-2 xl:h-full xl:min-h-120">
          <div className="flex items-start justify-between border-b border-slate-300 px-4 py-3">
            <div>
              <h2 className="font-bold text-slate-900">Current sale</h2>
              <p className="text-xs text-slate-500">Draft transaction</p>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{itemCount} items</span>
          </div>
          {selectedCustomer && (
            <div className="flex items-center justify-between border-b border-slate-200 bg-green-50 px-3 py-2 text-sm">
              <span className="truncate font-medium text-green-900">{selectedCustomer.name}</span>
              <button type="button" onClick={() => setSelectedCustomer(null)} className="ml-2 text-xs font-semibold text-green-800 hover:underline">Remove</button>
            </div>
          )}
          <div className="relative border-b border-slate-300 p-3">
            <div className="flex gap-2">
              <div className="relative min-w-0 flex-1">
                <ScanLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#21AC3A]" />
                <input
                  autoFocus
                  type="search"
                  placeholder="Scan barcode or search product"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-full border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#21AC3A]"
                />
              </div>
              <button
                type="button"
                onClick={() => setIsScannerOpen(true)}
                title="Scan barcode"
                className="border border-slate-300 px-3 text-slate-600 hover:bg-slate-50"
              >
                <ScanLine className="h-4 w-4" />
              </button>
            </div>
            {searchQuery && (
              <div className="absolute left-3 right-3 top-full z-20 max-h-64 overflow-auto border border-slate-300 bg-white shadow-lg">
                {filteredProducts.length ? filteredProducts.slice(0, 8).map((product) => (
                  <button
                    type="button"
                    key={product.id}
                    onClick={() => { addToCart(product); setSearchQuery(''); }}
                    className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-0 hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-slate-900">{product.name}</span>
                      <span className="block text-xs text-slate-500">{product.sku} · Stock {product.current_stock}</span>
                    </span>
                    <span className="whitespace-nowrap text-sm font-semibold text-slate-800">{formatIDR(product.selling_price_idr)}</span>
                  </button>
                )) : <p className="px-3 py-4 text-sm text-slate-500">No products found.</p>}
              </div>
            )}
          </div>
          <div className="min-h-40 flex-1 overflow-y-auto">
            {cart.length === 0 ? (
                <div className="flex h-full min-h-47.5 flex-col items-center justify-center px-5 text-center text-slate-400">
                <ShoppingCart className="mb-3 h-10 w-10 opacity-30" />
                <p className="text-sm font-medium">Your sale is empty</p>
                <p className="mt-1 text-xs">Search or scan a product to add it.</p>
              </div>
            ) : cart.map((item) => (
              <div key={item.id} className="border-b border-slate-200 px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.name}</p>
                    <p className="text-xs text-slate-500">{item.qty} × {formatIDR(item.price)}</p>
                  </div>
                  <p className="whitespace-nowrap text-sm text-slate-800">{formatIDR(item.price * item.qty)}</p>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center border border-slate-300">
                    <button type="button" onClick={() => updateQty(item.id, -1)} aria-label={`Decrease ${item.name}`} className="flex h-7 w-8 items-center justify-center text-slate-600 hover:bg-slate-100"><Minus className="h-3 w-3" /></button>
                    <span className="min-w-8 text-center text-xs font-semibold">{item.qty}</span>
                    <button type="button" onClick={() => updateQty(item.id, 1)} aria-label={`Increase ${item.name}`} className="flex h-7 w-8 items-center justify-center text-slate-600 hover:bg-slate-100"><Plus className="h-3 w-3" /></button>
                  </div>
                  <button type="button" onClick={() => removeFromCart(item.id)} aria-label={`Remove ${item.name}`} className="p-1.5 text-slate-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-2 border-t border-slate-300 px-3 py-3 text-sm">
            <div className="flex justify-between text-slate-600"><span>Subtotal</span><span>{formatIDR(subtotal)}</span></div>
            <div className="flex justify-between text-slate-600"><span>Discount</span><span>{formatIDR(totalDiscount)}</span></div>
            <div className="flex items-center justify-between border-t border-slate-200 pt-2 font-bold text-slate-900"><span>Total</span><span className="text-xl">{formatIDR(total)}</span></div>
            <button
              type="button"
              onClick={() => setIsPaymentModalOpen(true)}
              disabled={cart.length === 0}
              className="mt-2 w-full bg-[#21AC3A] py-3 text-sm font-bold text-white hover:bg-[#1d9732] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="inline-flex items-center justify-center gap-2"><CreditCard className="h-4 w-4" /> Charge {formatIDR(total)}</span>
            </button>
            <button
              type="button"
              onClick={() => setCart([])}
              disabled={cart.length === 0}
              className="w-full border border-slate-300 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear sale
            </button>
          </div>
        </aside>
      </main>

      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" aria-label="Close customer selection" className="absolute inset-0 bg-slate-900/50" onClick={() => setIsCustomerModalOpen(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="relative flex max-h-[80vh] w-full max-w-lg flex-col border border-slate-300 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div><h2 className="text-lg font-bold text-slate-900">Select customer</h2><p className="text-sm text-slate-500">Optional for this transaction</p></div>
              <button type="button" onClick={() => setIsCustomerModalOpen(false)} className="p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="border-b border-slate-200 p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input autoFocus value={customerQuery} onChange={(event) => setCustomerQuery(event.target.value)} placeholder="Search name, phone, or email" className="w-full border border-slate-300 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#21AC3A]" />
              </div>
            </div>
            <div className="overflow-y-auto">
              <button type="button" onClick={() => { setSelectedCustomer(null); setIsCustomerModalOpen(false); }} className="flex w-full items-center justify-between border-b border-slate-100 px-5 py-3 text-left hover:bg-slate-50">
                <span><span className="block text-sm font-semibold text-slate-800">Continue without a customer</span><span className="text-xs text-slate-500">Customer selection is optional</span></span>
                {!selectedCustomer && <Check className="h-4 w-4 text-[#21AC3A]" />}
              </button>
              {customersLoading ? <p className="px-5 py-8 text-center text-sm text-slate-500">Loading customers…</p> : customers.map((customer) => (
                <button type="button" key={customer.id} onClick={() => { setSelectedCustomer(customer); setIsCustomerModalOpen(false); }} className="flex w-full items-center justify-between border-b border-slate-100 px-5 py-3 text-left hover:bg-slate-50">
                  <span><span className="block text-sm font-semibold text-slate-900">{customer.name}</span><span className="text-xs text-slate-500">{customer.phone || customer.email || 'No contact details'}</span></span>
                  {selectedCustomer?.id === customer.id && <Check className="h-4 w-4 text-[#21AC3A]" />}
                </button>
              ))}
              {!customersLoading && customers.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">No customers found.</p>}
            </div>
          </motion.div>
        </div>
      )}

      {/* PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/45" onClick={() => setIsPaymentModalOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden border border-slate-300 bg-white shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-300 bg-white px-5 py-4">
              <h2 className="flex items-center gap-3 text-lg font-bold text-slate-900">
                <span className="flex h-10 w-10 items-center justify-center border border-green-200 bg-green-50 text-[#21AC3A]"><CreditCard className="h-5 w-5" /></span>
                <span><span className="block">Selesaikan Pembayaran</span><span className="mt-0.5 block text-xs font-normal text-slate-500">Pilih metode dan konfirmasi pembayaran</span></span>
              </h2>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="border border-slate-300 p-2 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto bg-[#f5f5f5] p-5">
              <div className="flex items-center justify-between gap-4 border border-slate-300 bg-white px-4 py-3">
                <p className="text-sm font-semibold text-slate-600">Total tagihan</p>
                <p className="text-2xl font-bold tracking-tight text-[#21AC3A]">
                  Rp {total.toLocaleString('id-ID')}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-slate-700">Metode pembayaran</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {paymentMethods.map((method) => (
                    <button
                      key={method.value}
                      type="button"
                      aria-pressed={paymentMethod === method.value}
                      onClick={() => {
                        setPaymentMethod(method.value);
                        setAmountPaid('');
                      }}
                      className={`border px-3 py-3 text-left text-sm font-semibold transition-colors ${paymentMethod === method.value ? 'border-[#21AC3A] bg-green-50 text-[#16852A]' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50'}`}
                    >
                      {method.label}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'cash' ? (
                <>
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-slate-700">Nominal uang diterima (Rp)</label>
                    <input
                      type="number"
                      min="0"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value ? Number(e.target.value) : '')}
                      className="w-full border border-slate-300 bg-white px-4 py-3 text-xl font-semibold text-slate-900 outline-none transition-colors focus:border-[#21AC3A]"
                      placeholder="0"
                      autoFocus
                    />
                  </div>

                  {typeof amountPaid === 'number' && amountPaid > 0 && (
                    <div className="flex items-center justify-between border border-slate-300 bg-white px-4 py-3">
                      <span className="font-semibold text-slate-600">Kembalian:</span>
                      <span className={`text-xl font-bold ${amountPaid - total < 0 ? 'text-red-500' : 'text-slate-900'}`}>
                        Rp {(amountPaid - total).toLocaleString('id-ID')}
                      </span>
                    </div>
                  )}

                  <div className="grid grid-cols-4 gap-2">
                    <div className="col-span-3 grid grid-cols-3 gap-2">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => handlePaymentNumpad(num.toString())}
                          className="flex items-center justify-center border border-slate-300 bg-white py-3 text-lg font-semibold text-slate-800 transition-colors hover:border-[#21AC3A] hover:bg-green-50"
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => handlePaymentNumpad('000')}
                        className="flex items-center justify-center border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-800 transition-colors hover:border-[#21AC3A] hover:bg-green-50"
                      >
                        000
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePaymentNumpad('0')}
                        className="flex items-center justify-center border border-slate-300 bg-white py-3 text-lg font-semibold text-slate-800 transition-colors hover:border-[#21AC3A] hover:bg-green-50"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePaymentNumpad('00')}
                        className="flex items-center justify-center border border-slate-300 bg-white py-3 text-sm font-semibold text-slate-800 transition-colors hover:border-[#21AC3A] hover:bg-green-50"
                      >
                        00
                      </button>
                    </div>

                    <div className="grid grid-rows-4 gap-2">
                      <button
                        type="button"
                        onClick={() => handlePaymentNumpad('DEL')}
                        aria-label="Delete last digit"
                        className="flex items-center justify-center border border-red-200 bg-red-50 text-red-700 transition-colors hover:bg-red-100"
                      >
                        <Delete className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePaymentNumpad('C')}
                        className="flex items-center justify-center border border-slate-300 bg-slate-100 font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePaymentNumpad('+50K')}
                        className="flex items-center justify-center border border-green-200 bg-green-50 text-sm font-semibold text-[#21AC3A] transition-colors hover:bg-green-100"
                      >
                        +50K
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePaymentNumpad('EXACT')}
                        className="flex items-center justify-center border border-slate-300 bg-white text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        Uang pas
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="border border-green-200 bg-green-50 px-4 py-3">
                  <p className="text-sm font-semibold text-green-900">
                    {paymentMethods.find((method) => method.value === paymentMethod)?.label} dipilih
                  </p>
                  <p className="mt-1 text-xs leading-5 text-green-800">
Verifikasi pembayaran telah diterima sebelum konfirmasi. Transaksi akan langsung dicatat sebagai lunas.
                  </p>
                </div>
              )}
            </div>

            <div className="flex shrink-0 gap-3 border-t border-slate-300 bg-white px-5 py-4">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

                    const orderPayload = {
                      payment_method: paymentMethod,
                      ...(selectedCustomer ? { customer_id: selectedCustomer.id } : {}),
                      items: cart.map(item => ({
                        product_id: item.id,
                        qty: item.qty
                      }))
                    };

                    const orderRes = await fetch(`/api/branches/${branchId}/orders`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                      },
                      body: JSON.stringify(orderPayload)
                    });

                    if (!orderRes.ok) {
                      const errData = await orderRes.json().catch(() => ({}));
                      throw new Error(errData.error || 'Failed to create order');
                    }

                    toast.success('Pembayaran Berhasil! Stok telah diperbarui.');

                    // Refresh products to get latest stock
                    const res = await fetch(`/api/branches/${branchId}/products`, {
                      headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                      const data = await res.json();
                      const payload: { data?: ProductResponse[] } = data;
                      const mappedProducts = (payload.data || []).map((p) => ({
                        id: p.product_id,
                        name: p.name,
                        sku: p.sku,
                        selling_price_idr: p.selling_price_idr,
                        current_stock: p.current_stock || 0,
                        image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=300&h=300&fit=crop'
                      }));
                      setProducts(mappedProducts);
                    }

                    setCart([]);
                    setSelectedCustomer(null);
                    setIsPaymentModalOpen(false);
                    setAmountPaid('');
                    void fetchOrders();
                  } catch (err: unknown) {
                    console.error(err);
                    toast.error(err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses pembayaran');
                  }
                }}
                disabled={paymentMethod === 'cash' && (typeof amountPaid !== 'number' || amountPaid < total)}
                className="flex-1 bg-[#21AC3A] px-4 py-3 text-sm font-bold text-white transition-colors hover:bg-[#1d9732] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {paymentMethod === 'cash' ? 'Selesaikan pembayaran' : `Konfirmasi ${paymentMethods.find((method) => method.value === paymentMethod)?.label ?? 'pembayaran'}`}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* SCANNER MODAL */}
      {isScannerOpen && (
        <ScannerModal
          onClose={() => setIsScannerOpen(false)}
          onScan={(decodedText) => {
            // Play a beep sound
            try {
              const AudioContextConstructor = window.AudioContext ||
                (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
              if (!AudioContextConstructor) throw new Error('Audio playback is unavailable');
              const audioCtx = new AudioContextConstructor();
              const oscillator = audioCtx.createOscillator();
              const gainNode = audioCtx.createGain();
              oscillator.connect(gainNode);
              gainNode.connect(audioCtx.destination);
              oscillator.type = 'sine';
              oscillator.frequency.setValueAtTime(800, audioCtx.currentTime);
              gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.1);
              oscillator.start(audioCtx.currentTime);
              oscillator.stop(audioCtx.currentTime + 0.1);
            } catch (e) {
              console.error("Audio playback failed", e);
            }

            // Check if product exists by SKU or ID
            const product = products.find(p => p.sku === decodedText || p.id === decodedText || p.name.includes(decodedText));
            if (product) {
              addToCart(product);
              setSearchQuery(''); // clear search bar
            } else {
              toast.error(`Produk dengan barcode ${decodedText} tidak ditemukan.`);
            }
            // intentionally NOT closing the modal here
          }}
        />
      )}

    </div>
  );
}

// Separate component for the scanner so it only mounts/unmounts when needed
function ScannerModal({ onClose, onScan }: { onClose: () => void, onScan: (text: string) => void }) {
  const onScanRef = useRef(onScan);

  // Keep the ref updated with the latest onScan closure so we don't need to change the function reference passed to Scanner
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const handleScan = useCallback((result: Array<{ rawValue: string }>) => {
    if (result && result.length > 0) {
      const text = result[0].rawValue;
      onScanRef.current(text);
    }
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col"
      >
        <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50 z-10">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-[#21AC3A]" />
            Scan Barcode
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-0 bg-black relative">
          <Scanner
            onScan={handleScan}
            formats={['qr_code', 'code_128', 'ean_13', 'ean_8']}
            allowMultiple={true}
            scanDelay={2000}
            onError={(error) => console.log(error?.message)}
          />
        </div>
      </motion.div>
    </div>
  );
}
