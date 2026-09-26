import { useState } from 'react';
import { motion } from 'framer-motion';
import { Scanner } from '@yudiel/react-qr-scanner';
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
  Delete
} from 'lucide-react';

// MOCK DATA
const MOCK_PRODUCTS = [
  { id: '1', name: 'Kopi Susu Gula Aren', category: 'Minuman', price: 18000, stock: 50, image: 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=300&h=300&fit=crop' },
  { id: '2', name: 'Americano Dingin', category: 'Minuman', price: 15000, stock: 45, image: 'https://images.unsplash.com/photo-1551030173-122aabc4489c?w=300&h=300&fit=crop' },
  { id: '3', name: 'Croissant Butter', category: 'Makanan', price: 25000, stock: 20, image: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=300&h=300&fit=crop' },
  { id: '4', name: 'Matcha Latte', category: 'Minuman', price: 22000, stock: 30, image: 'https://images.unsplash.com/photo-1536281140500-7b624405d66d?w=300&h=300&fit=crop' },
  { id: '5', name: 'Cookies Cokelat', category: 'Makanan', price: 12000, stock: 40, image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?w=300&h=300&fit=crop' },
  { id: '6', name: 'Nasi Goreng Spesial', category: 'Makanan', price: 35000, stock: 15, image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=300&h=300&fit=crop' },
  { id: '7', name: 'Es Teh Manis', category: 'Minuman', price: 8000, stock: 100, image: 'https://images.unsplash.com/photo-1499638673689-79a0b5115d87?w=300&h=300&fit=crop' },
  { id: '8', name: 'Kentang Goreng', category: 'Snack', price: 18000, stock: 25, image: 'https://images.unsplash.com/photo-1576107232684-1279f390859f?w=300&h=300&fit=crop' },
];

interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
  discount: number;
}

export default function BranchPOS() {
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [amountPaid, setAmountPaid] = useState<number | ''>('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

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
  const filteredProducts = MOCK_PRODUCTS.filter(p => {
    return p.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const addToCart = (product: typeof MOCK_PRODUCTS[0]) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1, discount: 0 }];
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
    <div className="flex flex-1 h-full w-full bg-slate-100 overflow-hidden">

      {/* LEFT PANEL: CART & NUMPAD */}
      <div className="w-[420px] bg-white flex flex-col h-full shrink-0 border-r border-slate-200 z-10">

        {/* Cart Header */}
        <div className="p-4 border-b border-slate-200 shrink-0 flex justify-between items-center bg-white">
          <button className="flex items-center gap-2 text-sm font-semibold text-slate-700 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors">
            <User className="w-4 h-4" />
            Customer
          </button>
          <button
            onClick={() => setCart([])}
            disabled={cart.length === 0}
            className="text-sm font-semibold text-red-500 hover:text-red-600 disabled:opacity-50 transition-colors"
          >
            Clear
          </button>
        </div>

        {/* Cart Items List */}
        <div className="flex-1 overflow-y-auto bg-slate-50">
          {cart.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6">
              <ShoppingCart className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-center font-medium">Cart is empty.</p>
              <p className="text-sm text-center mt-1">Select products to begin transaction.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {cart.map(item => (
                <div
                  key={item.id}
                  className="p-4 border-b border-slate-200 transition-colors bg-white hover:bg-slate-50"
                >
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-semibold text-sm text-slate-900">
                      {item.name}
                    </h4>
                    <p className="font-bold text-sm text-slate-900">
                      Rp {(item.price * item.qty).toLocaleString('id-ID')}
                    </p>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white">
                      <button
                        onClick={() => updateQty(item.id, -1)}
                        className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-bold text-slate-900">
                        {item.qty}
                      </span>
                      <button
                        onClick={() => updateQty(item.id, 1)}
                        className="w-8 h-8 flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Total Summary */}
        <div className="bg-white border-t border-slate-200 p-4 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="flex justify-between items-center">
            <span className="text-lg font-bold text-slate-700">Total</span>
            <span className="text-3xl font-black text-[#21AC3A]">Rp {total.toLocaleString('id-ID')}</span>
          </div>
        </div>

        {/* Action Bar (Customer / Note) */}
        <div className="flex grid-cols-2 bg-slate-100 p-2 gap-2 shrink-0 border-b border-slate-200">
          <button className="flex-1 bg-white border border-slate-200 rounded-lg py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 shadow-sm">
            Customer
          </button>
          <button className="flex-1 bg-white border border-slate-200 rounded-lg py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 shadow-sm">
            Diskon / Voucher
          </button>
        </div>

        {/* Numeric Keypad Layout */}
        <div className="bg-slate-50 p-2 shrink-0">
          <button
            onClick={() => setIsPaymentModalOpen(true)}
            disabled={cart.length === 0}
            className="w-full bg-[#21AC3A] text-white py-4 rounded-xl text-lg font-bold shadow-md shadow-[#21AC3A]/20 hover:bg-[#1d9732] active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
          >
            Payment
          </button>
        </div>

      </div>

      {/* RIGHT PANEL: PRODUCT CATALOG */}
      <div className="flex-1 flex flex-col h-full bg-white relative">

        {/* Top Header & Search */}
        <div className="p-4 border-b border-slate-200 shrink-0 flex gap-4 items-center bg-white shadow-sm z-10">
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border-none rounded-lg focus:outline-none focus:ring-2 focus:ring-[#21AC3A]/50 transition-all"
            />
          </div>
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-semibold transition-colors ml-auto shadow-sm"
          >
            <ScanLine className="w-4 h-4" />
            Scan Barcode
          </button>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto p-4 bg-slate-100">
          <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filteredProducts.map((product) => (
              <motion.div
                layoutId={`product-${product.id}`}
                key={product.id}
                onClick={() => addToCart(product)}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden cursor-pointer hover:border-[#21AC3A] hover:shadow-lg transition-all group flex flex-col shadow-sm"
              >
                <div className="h-28 bg-slate-100 relative overflow-hidden shrink-0">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-black/5 group-hover:bg-transparent transition-colors"></div>
                  {product.stock <= 20 && (
                    <div className="absolute top-1.5 right-1.5 bg-amber-500/90 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                      Sisa {product.stock}
                    </div>
                  )}
                </div>
                <div className="p-2.5 flex flex-col flex-1">
                  <h3 className="font-semibold text-slate-800 text-xs line-clamp-2 leading-tight flex-1">{product.name}</h3>
                  <p className="text-slate-900 font-bold text-sm mt-1">Rp {product.price.toLocaleString('id-ID')}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {filteredProducts.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <ScanLine className="w-12 h-12 mb-2 opacity-20" />
              <p>Tidak ada produk ditemukan.</p>
            </div>
          )}
        </div>
      </div>

      {/* PAYMENT MODAL */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsPaymentModalOpen(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex justify-between items-center shrink-0">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-[#21AC3A]" />
                Selesaikan Pembayaran
              </h2>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="text-center p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-sm font-semibold text-slate-500 mb-1">Total Tagihan</p>
                <p className="text-4xl font-black text-[#21AC3A]">
                  Rp {total.toLocaleString('id-ID')}
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Nominal Uang Diterima (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-4 py-3 text-lg font-bold bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-[#21AC3A] focus:ring-1 focus:ring-[#21AC3A] transition-all"
                  placeholder="0"
                  autoFocus
                />
              </div>

              {typeof amountPaid === 'number' && amountPaid > 0 && (
                <div className="flex justify-between items-center p-4 bg-slate-100 rounded-xl border border-slate-200">
                  <span className="font-semibold text-slate-600">Kembalian:</span>
                  <span className={`text-xl font-bold ${amountPaid - total < 0 ? 'text-red-500' : 'text-slate-900'}`}>
                    Rp {(amountPaid - total).toLocaleString('id-ID')}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-4 gap-2 mt-4">
                {/* Numbers */}
                <div className="col-span-3 grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                      key={num}
                      onClick={() => handlePaymentNumpad(num.toString())}
                      className="bg-white border border-slate-200 rounded-xl text-xl font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-[#21AC3A] transition-all active:scale-95 py-3 flex items-center justify-center"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    onClick={() => handlePaymentNumpad('000')}
                    className="bg-white border border-slate-200 rounded-xl text-lg font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-[#21AC3A] transition-all active:scale-95 py-3 flex items-center justify-center"
                  >
                    000
                  </button>
                  <button
                    onClick={() => handlePaymentNumpad('0')}
                    className="bg-white border border-slate-200 rounded-xl text-xl font-bold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-[#21AC3A] transition-all active:scale-95 py-3 flex items-center justify-center"
                  >
                    0
                  </button>
                  <button
                    onClick={() => handlePaymentNumpad('.')}
                    className="bg-slate-100 border border-slate-200 rounded-xl text-xl font-bold text-slate-700 shadow-sm hover:bg-slate-200 transition-all active:scale-95 py-3 flex items-center justify-center"
                  >
                    .
                  </button>
                </div>

                {/* Actions */}
                <div className="grid grid-rows-4 gap-2">
                  <button
                    onClick={() => handlePaymentNumpad('DEL')}
                    className="bg-red-50 border border-red-200 rounded-xl text-red-600 shadow-sm hover:bg-red-100 transition-all active:scale-95 flex items-center justify-center"
                  >
                    <Delete className="w-6 h-6" />
                  </button>
                  <button
                    onClick={() => handlePaymentNumpad('C')}
                    className="bg-slate-100 border border-slate-200 rounded-xl font-bold text-slate-600 shadow-sm hover:bg-slate-200 transition-all active:scale-95 flex items-center justify-center"
                  >
                    C
                  </button>
                  <button
                    onClick={() => handlePaymentNumpad('+50K')}
                    className="bg-[#21AC3A]/10 border border-[#21AC3A]/30 rounded-xl font-bold text-[#21AC3A] shadow-sm hover:bg-[#21AC3A]/20 transition-all active:scale-95 flex items-center justify-center text-sm"
                  >
                    +50K
                  </button>
                  <button
                    onClick={() => handlePaymentNumpad('EXACT')}
                    className="bg-amber-100 border border-amber-300 rounded-xl font-bold text-amber-700 shadow-sm hover:bg-amber-200 transition-all active:scale-95 flex items-center justify-center text-sm"
                  >
                    Uang Pas
                  </button>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3">
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 px-4 py-3 text-sm font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={() => {
                  alert('Pembayaran Berhasil!');
                  setCart([]);
                  setIsPaymentModalOpen(false);
                  setAmountPaid('');
                }}
                disabled={typeof amountPaid !== 'number' || amountPaid < total}
                className="flex-1 px-4 py-3 text-sm font-bold text-white bg-[#21AC3A] hover:bg-[#1d9732] shadow-sm shadow-[#21AC3A]/20 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
              >
                Selesaikan
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
            // Check if product exists by SKU or ID (mock data uses ID as SKU for now)
            const product = MOCK_PRODUCTS.find(p => p.id === decodedText || p.name.includes(decodedText));
            if (product) {
              addToCart(product);
            } else {
              alert(`Produk dengan barcode ${decodedText} tidak ditemukan.`);
            }
            setIsScannerOpen(false);
          }}
        />
      )}

    </div>
  );
}

// Separate component for the scanner so it only mounts/unmounts when needed
function ScannerModal({ onClose, onScan }: { onClose: () => void, onScan: (text: string) => void }) {
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
            onScan={(result) => {
              if (result && result.length > 0) {
                onScan(result[0].rawValue);
              }
            }}
            formats={['qr_code', 'code_128', 'ean_13', 'ean_8']}
            onError={(error) => console.log(error?.message)}
          />
        </div>
      </motion.div>
    </div>
  );
}
