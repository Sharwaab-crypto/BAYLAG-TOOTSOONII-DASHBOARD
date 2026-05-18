import { useState, useMemo, useEffect } from 'react';
import {
  Plus, Calendar, BarChart3, FileSpreadsheet, Package, AlertCircle,
  Edit2, Trash2, Search, Boxes, Archive, ChevronRight, Users, DollarSign,
  ArrowUpRight, ArrowDownRight, Bell, Settings, X,
  Calculator, Sigma, Save, TrendingDown, PackagePlus, ArrowDownCircle,
  ClipboardList, FileText, Download, Receipt, CheckCircle2, Eye, LogOut, Shield
} from 'lucide-react';
import {
  BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList
} from 'recharts';
import * as XLSX from 'xlsx';
import { supabase } from './supabase';

const GRADIENTS = [
  { id: 'pink',   cls: 'from-fuchsia-400 via-pink-500 to-purple-500',   name: 'Ягаан',    hex: '#ec4899' },
  { id: 'blue',   cls: 'from-cyan-400 via-sky-500 to-blue-500',         name: 'Цэнхэр',   hex: '#0ea5e9' },
  { id: 'orange', cls: 'from-orange-400 via-orange-500 to-red-500',     name: 'Улбар',    hex: '#f97316' },
  { id: 'green',  cls: 'from-emerald-400 via-teal-500 to-cyan-500',     name: 'Ногоон',   hex: '#10b981' },
  { id: 'rose',   cls: 'from-rose-400 via-pink-500 to-rose-600',        name: 'Сарнай',   hex: '#f43f5e' },
  { id: 'violet', cls: 'from-violet-500 via-purple-500 to-fuchsia-500', name: 'Ягаавтар', hex: '#8b5cf6' }
];

const CATEGORIES = ['Хүнсний', 'Ундаа', 'Чихрийн', 'Ариун цэвэр', 'Бусад'];

const gradById = (id) => GRADIENTS.find(g => g.id === id) || GRADIENTS[0];
const fmt = (n) => typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : n;
const getStatus = (p) => p.stock === 0 ? 'out' : p.stock < p.max * 0.2 ? 'low' : 'normal';

// Огнооны туслах функцүүд (local timezone-той зөв ажиллана)
const pad2 = (n) => String(n).padStart(2, '0');
const dateKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayStr = () => dateKey(new Date());
const yesterdayStr = () => dateKey(new Date(Date.now() - 86400000));
const monthStr = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
const yearStr  = (d = new Date()) => String(d.getFullYear());

// Картын анхны үзүүлэх загварт зориулсан 60 хоногийн санамсаргүй өгөгдөл (нэг удаа үүснэ)
const sampleDaily = (monthlyTotal) => {
  if (!monthlyTotal) return {};
  const out = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dailyAvg = monthlyTotal / 30;
  for (let i = 59; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000);
    out[dateKey(d)] = Math.max(0, Math.round(dailyAvg * (0.4 + Math.random() * 1.2)));
  }
  return out;
};

function Field({ label, children, hint }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-600 mb-1.5 block">{label}</label>
      {children}
      {hint && <div className="text-[10px] text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

function Modal({ onClose, title, icon: Icon, children, maxWidth = 'max-w-md' }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={onClose}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} max-h-[90vh] overflow-y-auto`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center">
              <Icon className="w-4 h-4 text-white" />
            </div>
            <h3 className="font-bold text-slate-800">{title}</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export default function Dashboard({ session, profile }) {
  // Эрхийг шалгах
  const canEdit = profile?.role === 'admin' || profile?.role === 'manager';
  const isAdmin = profile?.role === 'admin';

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const [period, setPeriod] = useState('Сар');
  const [view, setView] = useState('Карт');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('kpi');

  // Огноо сонгох (real today-аас эхэлнэ)
  const [selectedDate, setSelectedDate] = useState(monthStr()); // YYYY-MM
  const [selectedDay, setSelectedDay] = useState(todayStr());   // YYYY-MM-DD
  const [selectedYear, setSelectedYear] = useState(yearStr());
  const [customRange, setCustomRange] = useState(() => {
    const d = new Date();
    const start = dateKey(new Date(d.getFullYear(), d.getMonth(), 1));
    const end = dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
    return { start, end };
  });

  // Картын модалууд
  const [editingCard, setEditingCard] = useState(null);
  const [creatingDeptId, setCreatingDeptId] = useState(null);
  const [formulaModalDept, setFormulaModalDept] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(null); // { deptId, cardId, label }
  const [dailyEntryDeptId, setDailyEntryDeptId] = useState(null); // өдрийн тоо оруулах модал

  // Барааны модалууд
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [showReceiveStock, setShowReceiveStock] = useState(false);
  const [confirmingProductDelete, setConfirmingProductDelete] = useState(null); // { id, name, code }

  // Тооцооны төлөв
  const [reconciliations, setReconciliations] = useState([]);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const [viewingReconcile, setViewingReconcile] = useState(null);
  const [confirmingReconcileDelete, setConfirmingReconcileDelete] = useState(null);

  // Огнооны харагдац
  const MONTHS_MN = ['1-р сар','2-р сар','3-р сар','4-р сар','5-р сар','6-р сар','7-р сар','8-р сар','9-р сар','10-р сар','11-р сар','12-р сар'];
  const MONTHS_EN = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

  const dateDisplay = useMemo(() => {
    if (period === 'Өнөөдөр' || period === 'Өчигдөр') {
      const d = period === 'Өчигдөр' ? new Date(Date.now() - 86400000) : new Date(selectedDay);
      return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
    }
    if (period === '7 хоног') {
      const end = new Date(selectedDay);
      const start = new Date(end.getTime() - 6 * 86400000);
      const fmtD = (d) => `${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
      return `${fmtD(start)} - ${fmtD(end)}`;
    }
    if (period === 'Сар') {
      const [y, m] = selectedDate.split('-');
      return `${MONTHS_EN[parseInt(m)-1]} ${y}`;
    }
    if (period === 'Жил') return `${selectedYear} он`;
    if (period === 'Гар') {
      if (!customRange.start || !customRange.end) return 'Огноо сонгоогүй';
      return `${customRange.start} → ${customRange.end}`;
    }
    return '';
  }, [period, selectedDate, selectedDay, selectedYear, customRange]);

  const periodSubtitle = useMemo(() => {
    switch (period) {
      case 'Өнөөдөр': return 'Өнөөдрийн дүн';
      case 'Өчигдөр': return 'Өчигдрийн дүн';
      case '7 хоног': return '7 хоногийн нийт';
      case 'Сар':    return `${dateDisplay} нийт`;
      case 'Жил':    return `${selectedYear} оны нийт`;
      case 'Гар':    return (!customRange.start || !customRange.end) ? 'Огноо сонгоогүй' : `${customRange.start} → ${customRange.end}`;
      default:       return '';
    }
  }, [period, dateDisplay, selectedYear, customRange]);

  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState([]);

  // Барааны жагсаалт (Supabase-аас ачаална)
  const [products, setProducts] = useState([]);

  // Барааны функцүүд
  // Supabase-аас бүх өгөгдөл татах
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      // Хэлтэс + картууд
      const { data: depts } = await supabase.from('departments').select('*');
      const { data: cardsData } = await supabase.from('cards').select('*');

      if (depts) {
        const grouped = depts.map(d => ({
          id: d.id,
          name: d.name,
          icon: d.icon,
          cards: (cardsData || []).filter(c => c.dept_id === d.id).map(c => ({
            id: c.id,
            label: c.label,
            unit: c.unit || '',
            gradientId: c.gradient_id || 'pink',
            trend: c.trend,
            target: c.target,
            formula: c.formula,
            dailyValues: c.daily_values || {}
          }))
        }));
        setDepartments(grouped);
      }

      // Бараа
      const { data: prods } = await supabase.from('products').select('*').order('id');
      if (prods) {
        setProducts(prods.map(p => ({
          id: p.id,
          code: p.code,
          name: p.name,
          category: p.category,
          location: p.location,
          stock: p.stock,
          max: p.max_stock,
          costPrice: Number(p.cost_price),
          salePrice: Number(p.sale_price)
        })));
      }

      // Тооцоо архив
      const { data: recs } = await supabase
        .from('reconciliations').select('*')
        .order('archived_at', { ascending: false });
      if (recs) {
        setReconciliations(recs.map(r => ({
          id: r.id,
          date: r.date,
          label: r.label,
          items: r.items,
          totalAmount: Number(r.total_amount),
          notes: r.notes,
          deductedStock: r.deducted_stock,
          archivedAt: r.archived_at
        })));
      }
    } catch (err) {
      console.error('Supabase ачаалах алдаа:', err);
      alert('Өгөгдөл ачаалахад алдаа гарлаа. Console-г шалгана уу.');
    } finally {
      setLoading(false);
    }
  };

  // Барааны функцүүд
  const addProduct = async (p) => {
    const nextNum = products.length > 0
      ? Math.max(...products.map(x => parseInt(x.id.replace(/\D/g, '')) || 0)) + 1
      : 1;
    const id = `BR-${String(nextNum).padStart(3, '0')}`;

    const { error } = await supabase.from('products').insert({
      id, code: p.code, name: p.name, category: p.category, location: p.location,
      stock: p.stock, max_stock: p.max, cost_price: p.costPrice, sale_price: p.salePrice
    });
    if (error) { alert('Бараа нэмэх алдаа: ' + error.message); return; }

    setProducts(prev => [...prev, { id, ...p }]);
  };

  const receiveStock = async (productId, qty, newCostPrice) => {
    const p = products.find(pr => pr.id === productId);
    if (!p) return;
    const updates = { stock: p.stock + qty };
    let newCost = p.costPrice;
    if (newCostPrice && newCostPrice > 0) {
      const totalCost = (p.stock * p.costPrice) + (qty * newCostPrice);
      const totalStock = p.stock + qty;
      newCost = totalStock > 0 ? Math.round(totalCost / totalStock) : newCostPrice;
      updates.costPrice = newCost;
    }

    const { error } = await supabase.from('products').update({
      stock: updates.stock, cost_price: newCost, updated_at: new Date().toISOString()
    }).eq('id', productId);
    if (error) { alert('Орлого бүртгэх алдаа: ' + error.message); return; }

    setProducts(prev => prev.map(pp => pp.id !== productId ? pp : { ...pp, ...updates }));
  };

  const deleteProduct = (productId) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setConfirmingProductDelete({ id: productId, name: product.name, code: product.code });
  };
  const confirmDeleteProduct = async () => {
    if (!confirmingProductDelete) return;
    const { error } = await supabase.from('products').delete().eq('id', confirmingProductDelete.id);
    if (error) { alert('Устгах алдаа: ' + error.message); return; }
    setProducts(prev => prev.filter(p => p.id !== confirmingProductDelete.id));
    setConfirmingProductDelete(null);
  };

  // Тооцоо хадгалах
  const saveReconciliation = async (data) => {
    const id = `rec_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const archivedAt = new Date().toISOString();
    const newRec = {
      id, date: data.date, label: data.label, items: data.items,
      totalAmount: data.totalAmount, notes: data.notes,
      deductedStock: data.deductedStock, archivedAt
    };

    const { error } = await supabase.from('reconciliations').insert({
      id, date: data.date, label: data.label, items: data.items,
      total_amount: data.totalAmount, notes: data.notes,
      deducted_stock: data.deductedStock
    });
    if (error) { alert('Тооцоо хадгалах алдаа: ' + error.message); return; }

    // Нөөцөөс хасах
    if (data.deductedStock) {
      for (const item of data.items) {
        const p = products.find(pp => pp.id === item.productId);
        if (p) {
          const newStock = Math.max(0, p.stock - item.qty);
          await supabase.from('products').update({ stock: newStock }).eq('id', p.id);
        }
      }
      setProducts(prev => prev.map(p => {
        const item = data.items.find(i => i.productId === p.id);
        if (!item) return p;
        return { ...p, stock: Math.max(0, p.stock - item.qty) };
      }));
    }

    setReconciliations(prev => [newRec, ...prev]);
  };

  const deleteReconciliation = (id) => {
    const rec = reconciliations.find(r => r.id === id);
    if (!rec) return;
    setConfirmingReconcileDelete(rec);
  };
  const confirmDeleteReconciliation = async () => {
    if (!confirmingReconcileDelete) return;
    const { error } = await supabase.from('reconciliations').delete().eq('id', confirmingReconcileDelete.id);
    if (error) { alert('Устгах алдаа: ' + error.message); return; }
    setReconciliations(prev => prev.filter(r => r.id !== confirmingReconcileDelete.id));
    setConfirmingReconcileDelete(null);
  };

  // ====== KPI картын функцүүд ======
  const allCards = useMemo(
    () => departments.flatMap(d => d.cards.map(c => ({ ...c, deptName: d.name }))),
    [departments]
  );

  // Сонгосон period дотроо багтах огнуудыг олох функц
  const isDateInPeriod = (dateStr) => {
    if (period === 'Өнөөдөр') return dateStr === selectedDay;
    if (period === 'Өчигдөр') return dateStr === yesterdayStr();
    if (period === '7 хоног') {
      const end = new Date(selectedDay);
      const start = new Date(end.getTime() - 6 * 86400000);
      const d = new Date(dateStr);
      return d >= start && d <= end;
    }
    if (period === 'Сар') return dateStr.startsWith(selectedDate); // YYYY-MM
    if (period === 'Жил') return dateStr.startsWith(selectedYear);
    if (period === 'Гар') {
      return customRange.start && customRange.end &&
             dateStr >= customRange.start && dateStr <= customRange.end;
    }
    return false;
  };

  // Картын дайли утгуудаас нийлбэр гаргах
  const aggregateValue = (card) => {
    const dv = card?.dailyValues || {};
    let sum = 0;
    for (const [date, val] of Object.entries(dv)) {
      if (isDateInPeriod(date)) sum += Number(val) || 0;
    }
    return sum;
  };

  const computeValue = (card) => {
    if (!card) return 0;
    if (card.formula) {
      const a = allCards.find(c => c.id === card.formula.aId);
      const b = allCards.find(c => c.id === card.formula.bId);
      if (!a || !b) return 0;
      const av = computeValue(a);
      const bv = computeValue(b);
      switch (card.formula.op) {
        case '+': return av + bv;
        case '-': return av - bv;
        case '*': return av * bv;
        case '/': return bv === 0 ? 0 : av / bv;
        default:  return 0;
      }
    }
    return aggregateValue(card);
  };

  const updateCard = async (deptId, cardId, updates) => {
    const dbUpdates = {};
    if ('label' in updates) dbUpdates.label = updates.label;
    if ('unit' in updates) dbUpdates.unit = updates.unit;
    if ('gradientId' in updates) dbUpdates.gradient_id = updates.gradientId;
    if ('trend' in updates) dbUpdates.trend = updates.trend;
    if ('target' in updates) dbUpdates.target = updates.target;
    if ('dailyValues' in updates) dbUpdates.daily_values = updates.dailyValues;
    dbUpdates.updated_at = new Date().toISOString();

    const { error } = await supabase.from('cards').update(dbUpdates).eq('id', cardId);
    if (error) { alert('Засварлах алдаа: ' + error.message); return; }

    setDepartments(prev => prev.map(d =>
      d.id !== deptId ? d : { ...d, cards: d.cards.map(c => c.id === cardId ? { ...c, ...updates } : c) }
    ));
  };
  const deleteCard = (deptId, cardId) => {
    const card = departments.find(d => d.id === deptId)?.cards.find(c => c.id === cardId);
    if (!card) return;
    const dependents = [];
    departments.forEach(d => d.cards.forEach(c => {
      if (c.formula && (c.formula.aId === cardId || c.formula.bId === cardId)) {
        dependents.push(`${d.name} · ${c.label}`);
      }
    }));
    setConfirmingDelete({ deptId, cardId, label: card.label, dependents });
  };
  const confirmDeleteCard = async () => {
    if (!confirmingDelete) return;
    const { deptId, cardId } = confirmingDelete;
    const { error } = await supabase.from('cards').delete().eq('id', cardId);
    if (error) { alert('Устгах алдаа: ' + error.message); return; }
    setDepartments(prev => prev.map(d => d.id !== deptId ? d : { ...d, cards: d.cards.filter(c => c.id !== cardId) }));
    setConfirmingDelete(null);
  };
  const addCard = async (deptId, card) => {
    const id = `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const { initialValue, ...rest } = card;
    const finalCard = { id, ...rest };
    if (!finalCard.formula && !finalCard.dailyValues) {
      finalCard.dailyValues = initialValue ? { [todayStr()]: Number(initialValue) || 0 } : {};
    }

    const { error } = await supabase.from('cards').insert({
      id, dept_id: deptId, label: finalCard.label, unit: finalCard.unit,
      gradient_id: finalCard.gradientId, trend: finalCard.trend, target: finalCard.target,
      formula: finalCard.formula, daily_values: finalCard.dailyValues || {}
    });
    if (error) { alert('Карт нэмэх алдаа: ' + error.message); return; }

    setDepartments(prev => prev.map(d => d.id !== deptId ? d : { ...d, cards: [...d.cards, finalCard] }));
  };

  // Тухайн өдрийн утгуудыг хадгалах (олон карт нэгэн зэрэг)
  const saveDailyEntries = async (deptId, date, entries) => {
    const dept = departments.find(d => d.id === deptId);
    if (!dept) return;

    // Supabase-д тус бүрчлэн UPDATE
    for (const card of dept.cards) {
      if (card.formula) continue;
      if (!(card.id in entries)) continue;
      const newDV = { ...(card.dailyValues || {}) };
      const val = entries[card.id];
      if (val === '' || val === null || val === undefined) {
        delete newDV[date];
      } else {
        newDV[date] = Number(val) || 0;
      }
      await supabase.from('cards').update({
        daily_values: newDV, updated_at: new Date().toISOString()
      }).eq('id', card.id);
    }

    setDepartments(prev => prev.map(d => {
      if (d.id !== deptId) return d;
      return {
        ...d,
        cards: d.cards.map(c => {
          if (c.formula) return c;
          if (!(c.id in entries)) return c;
          const val = entries[c.id];
          const newDV = { ...(c.dailyValues || {}) };
          if (val === '' || val === null || val === undefined) {
            delete newDV[date];
          } else {
            newDV[date] = Number(val) || 0;
          }
          return { ...c, dailyValues: newDV };
        })
      };
    }));
  };

  const exportToExcel = () => {
    const wb = XLSX.utils.book_new();

    // KPI sheet-ууд (period-ийн нийлбэр)
    departments.forEach(dept => {
      const rows = dept.cards.map(c => ({
        'Карт ID': c.id,
        'Нэр': c.label,
        'Утга (нийлбэр)': computeValue(c),
        'Нэгж': c.unit || '',
        'Тренд (%)': c.trend ?? '',
        'Зорилго': c.target ?? '',
        'Тооцооны томьёо': c.formula
          ? `${allCards.find(x => x.id === c.formula.aId)?.label} ${c.formula.op} ${allCards.find(x => x.id === c.formula.bId)?.label}`
          : '',
        'Бичсэн өдрийн тоо': c.formula ? '-' : Object.keys(c.dailyValues || {}).length
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = [{ wch: 14 }, { wch: 28 }, { wch: 14 }, { wch: 8 }, { wch: 10 }, { wch: 14 }, { wch: 36 }, { wch: 16 }];
      XLSX.utils.book_append_sheet(wb, ws, dept.name);
    });

    // Өдрийн дэлгэрэнгүй sheet
    const allDates = new Set();
    departments.forEach(d => d.cards.forEach(c => Object.keys(c.dailyValues || {}).forEach(k => allDates.add(k))));
    const sortedDates = Array.from(allDates).sort();
    const dailyHeaders = ['Огноо', ...allCards.filter(c => !c.formula).map(c => `${c.deptName}·${c.label}`)];
    const dailyRows = sortedDates.map(date => {
      const row = { 'Огноо': date };
      allCards.filter(c => !c.formula).forEach(c => {
        row[`${c.deptName}·${c.label}`] = c.dailyValues?.[date] ?? '';
      });
      return row;
    });
    if (dailyRows.length > 0) {
      const wsDaily = XLSX.utils.json_to_sheet(dailyRows, { header: dailyHeaders });
      wsDaily['!cols'] = dailyHeaders.map(() => ({ wch: 16 }));
      XLSX.utils.book_append_sheet(wb, wsDaily, 'Өдрийн дэлгэрэнгүй');
    }

    // Барааны sheet
    const productRows = products.map(p => ({
      'ID': p.id,
      'Дотоод код': p.code,
      'Нэр': p.name,
      'Ангилал': p.category,
      'Байршил': p.location,
      'Нөөц': p.stock,
      'Хамгийн их': p.max,
      'Өртөг үнэ': p.costPrice,
      'Зарах үнэ': p.salePrice,
      'Маржин (%)': p.salePrice > 0 ? Math.round(((p.salePrice - p.costPrice) / p.salePrice) * 100) : 0,
      'Нөөцийн үнэ': p.stock * p.costPrice,
      'Төлөв': { normal: 'Хэвийн', low: 'Бага', out: 'Дууссан' }[getStatus(p)]
    }));
    const wsProd = XLSX.utils.json_to_sheet(productRows);
    wsProd['!cols'] = [{wch:10},{wch:14},{wch:24},{wch:12},{wch:10},{wch:8},{wch:10},{wch:12},{wch:12},{wch:10},{wch:14},{wch:10}];
    XLSX.utils.book_append_sheet(wb, wsProd, 'Бараа нөөц');

    // Тооцооны архив (товч)
    if (reconciliations.length > 0) {
      const recRows = reconciliations.map(r => ({
        'Огноо': r.date,
        'Нэр': r.label,
        'Барааны тоо': r.items.length,
        'Нийт ширхэг': r.items.reduce((s, i) => s + i.qty, 0),
        'Нийт дүн (₮)': r.totalAmount,
        'Нөөцөөс хасагдсан': r.deductedStock ? 'Тийм' : 'Үгүй',
        'Тайлбар': r.notes || '',
        'Архивласан': new Date(r.archivedAt).toLocaleString('mn-MN')
      }));
      const wsRec = XLSX.utils.json_to_sheet(recRows);
      wsRec['!cols'] = [{wch:12},{wch:28},{wch:12},{wch:12},{wch:14},{wch:16},{wch:24},{wch:20}];
      XLSX.utils.book_append_sheet(wb, wsRec, 'Тооцооны архив');

      // Тооцооны дэлгэрэнгүй (бараа тус бүр)
      const detailRows = [];
      reconciliations.forEach(r => {
        r.items.forEach(it => {
          detailRows.push({
            'Огноо': r.date,
            'Тооцоо': r.label,
            'Дотоод код': it.productCode,
            'Барааны нэр': it.productName,
            'Тоо': it.qty,
            'Нэгж үнэ (₮)': it.unitPrice,
            'Мөрийн дүн (₮)': it.lineTotal
          });
        });
      });
      const wsDetail = XLSX.utils.json_to_sheet(detailRows);
      wsDetail['!cols'] = [{wch:12},{wch:24},{wch:14},{wch:24},{wch:8},{wch:14},{wch:14}];
      XLSX.utils.book_append_sheet(wb, wsDetail, 'Тооцоо дэлгэрэнгүй');
    }

    XLSX.writeFile(wb, `KPI_Dashboard_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleViewClick = (v) => {
    if (v === 'Excel') { exportToExcel(); return; }
    setView(v);
  };

  const periods = ['Өнөөдөр', 'Өчигдөр', '7 хоног', 'Сар', 'Жил', 'Гар'];
  const views = [
    { name: 'Карт',   icon: Package },
    { name: 'График', icon: BarChart3 },
    { name: 'Excel',  icon: FileSpreadsheet }
  ];

  // Барааны статистик (динамик)
  const inventoryStats = useMemo(() => {
    const total = products.length;
    const inStock = products.filter(p => getStatus(p) === 'normal').length;
    const lowStock = products.filter(p => getStatus(p) === 'low').length;
    const outStock = products.filter(p => getStatus(p) === 'out').length;
    const totalValue = products.reduce((sum, p) => sum + p.stock * p.costPrice, 0);
    return [
      { label: 'НИЙТ БАРАА',   value: total.toLocaleString(),    unit: 'төрөл', icon: Boxes,        gradient: 'from-fuchsia-400 via-pink-500 to-purple-500', sub: `${products.reduce((s,p)=>s+p.stock,0).toLocaleString()} ширхэг нийт` },
      { label: 'НӨӨЦӨД БУЙ',   value: inStock.toLocaleString(),  unit: 'төрөл', icon: Archive,      gradient: 'from-emerald-400 via-teal-500 to-cyan-500',   sub: `${(totalValue/1000000).toFixed(1)}М₮ үнэлгээ` },
      { label: 'БАГА НӨӨЦТЭЙ', value: lowStock.toLocaleString(), unit: 'төрөл', icon: AlertCircle,  gradient: 'from-orange-400 via-orange-500 to-red-500',   sub: 'Дахин захиалга шаардлагатай' },
      { label: 'ДУУССАН',      value: outStock.toLocaleString(), unit: 'төрөл', icon: TrendingDown, gradient: 'from-rose-400 via-pink-500 to-rose-600',     sub: 'Шууд орлогдох хэрэгтэй' }
    ];
  }, [products]);

  const movementData = [
    { day: '01', irsen: 45, garsan: 32 }, { day: '05', irsen: 62, garsan: 48 },
    { day: '10', irsen: 38, garsan: 55 }, { day: '15', irsen: 78, garsan: 41 },
    { day: '20', irsen: 54, garsan: 67 }, { day: '25', irsen: 89, garsan: 52 },
    { day: '30', irsen: 71, garsan: 58 }
  ];

  // Ангиллын dynamic data products-аас
  const categoryData = useMemo(() => {
    const colors = { 'Хүнсний': '#ec4899', 'Ундаа': '#06b6d4', 'Чихрийн': '#f97316', 'Ариун цэвэр': '#10b981', 'Бусад': '#8b5cf6' };
    const map = {};
    products.forEach(p => {
      map[p.category] = (map[p.category] || 0) + p.stock;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value, color: colors[name] || '#94a3b8' }));
  }, [products]);

  const filteredProducts = useMemo(() =>
    !searchQuery ? products :
      products.filter(p => [p.name, p.id, p.code, p.category].some(t => (t || '').toLowerCase().includes(searchQuery.toLowerCase()))),
    [products, searchQuery]);

  // ====== KPI карт ======
  const KPICard = ({ deptId, card }) => {
    const value = computeValue(card);
    const grad = gradById(card.gradientId);
    const isFormula = !!card.formula;
    const formulaText = isFormula
      ? `${allCards.find(c => c.id === card.formula.aId)?.label || '?'} ${card.formula.op === '*' ? '×' : card.formula.op === '/' ? '÷' : card.formula.op} ${allCards.find(c => c.id === card.formula.bId)?.label || '?'}`
      : null;

    return (
      <div className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${grad.cls} p-5 text-white shadow-lg shadow-pink-500/10 transition-all hover:scale-[1.02] hover:shadow-xl group`}>
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl"></div>
        <div className="absolute -bottom-12 -left-4 h-20 w-20 rounded-full bg-white/10 blur-xl"></div>

        {canEdit && (
          <div className="absolute top-3 right-3 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
            <button onClick={() => setEditingCard({ deptId, cardId: card.id })} className="p-1.5 rounded-md bg-white/20 hover:bg-white/30 backdrop-blur" title="Засварлах">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => deleteCard(deptId, card.id)} className="p-1.5 rounded-md bg-white/20 hover:bg-white/30 backdrop-blur" title="Устгах">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {isFormula && (
          <div className="absolute top-3 left-3">
            <div className="px-1.5 py-0.5 rounded-md bg-white/25 backdrop-blur text-[9px] font-bold flex items-center gap-1">
              <Sigma className="w-2.5 h-2.5" /> ТООЦОО
            </div>
          </div>
        )}

        <div className="relative">
          <div className={`text-[10px] font-bold tracking-wider opacity-90 mb-3 ${isFormula ? 'mt-5' : ''}`}>{card.label}</div>
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-3xl font-bold tracking-tight">{fmt(value)}</span>
            {card.unit && <span className="text-sm opacity-80">{card.unit}</span>}
          </div>

          {isFormula && (
            <div className="text-[10px] opacity-75 mt-1 mb-2 truncate" title={formulaText}>ƒ {formulaText}</div>
          )}

          <div className="h-px bg-white/40 my-3 w-3/4"></div>

          <div className="flex items-end justify-between">
            <div className="text-[11px] opacity-80">{periodSubtitle || card.subtitle}</div>
            {card.trend !== undefined && card.trend !== null && card.trend !== '' && (
              <div className="flex items-center gap-0.5 text-[11px] font-semibold">
                {card.trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(card.trend)}%
              </div>
            )}
          </div>

          {card.target && (
            <div className="mt-2">
              <div className="flex items-center justify-between text-[10px] mb-1 opacity-90">
                <span>◎ {fmt(card.target)}</span>
                <span className="font-bold">{Math.round((value / card.target) * 100)}%</span>
              </div>
              <div className="h-1 bg-white/30 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full" style={{ width: `${Math.min(100, (value / card.target) * 100)}%` }}></div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ====== Графикийн харагдац ======
  const DepartmentChart = ({ dept }) => {
    const data = dept.cards.map(c => ({
      name: c.label.length > 16 ? c.label.slice(0, 16) + '…' : c.label,
      fullName: c.label,
      value: computeValue(c),
      fill: gradById(c.gradientId).hex
    }));
    return (
      <ResponsiveContainer width="100%" height={Math.max(280, dept.cards.length * 44)}>
        <BarChart data={data} layout="vertical" margin={{ top: 10, right: 60, left: 10, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#fce7f3" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false}
                 tickFormatter={v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}М` : v >= 1000 ? `${(v / 1000).toFixed(0)}к` : v} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: '#475569', fontWeight: 600 }} axisLine={false} tickLine={false} width={150} />
          <Tooltip contentStyle={{ background: 'white', border: '1px solid #fce7f3', borderRadius: 12, fontSize: 12 }}
                   formatter={v => fmt(v)}
                   labelFormatter={(_, payload) => payload?.[0]?.payload?.fullName || ''} />
          <Bar dataKey="value" radius={[0, 8, 8, 0]}>
            {data.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            <LabelList dataKey="value" position="right" style={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} formatter={v => fmt(v)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  };

  // ====== ФОРМУЛА МОДАЛ ======
  const FormulaModal = ({ deptId, onClose }) => {
    const [name, setName] = useState('');
    const [unit, setUnit] = useState('');
    const [aId, setAId] = useState(allCards[0]?.id || '');
    const [op, setOp] = useState('+');
    const [bId, setBId] = useState(allCards[1]?.id || allCards[0]?.id || '');
    const [gradientId, setGradientId] = useState('violet');

    const a = allCards.find(c => c.id === aId);
    const b = allCards.find(c => c.id === bId);
    const av = a ? computeValue(a) : 0;
    const bv = b ? computeValue(b) : 0;
    const result = (() => {
      switch (op) {
        case '+': return av + bv;
        case '-': return av - bv;
        case '*': return av * bv;
        case '/': return bv === 0 ? 0 : av / bv;
        default:  return 0;
      }
    })();

    const handleSave = () => {
      if (!name.trim()) { alert('Картын нэр оруулна уу'); return; }
      if (!a || !b) { alert('Хоёр картыг сонгоно уу'); return; }
      addCard(deptId, {
        label: name.toUpperCase(), unit, gradientId, trend: null,
        formula: { aId, op, bId }
      });
      onClose();
    };

    return (
      <Modal onClose={onClose} title="Тооцооны карт үүсгэх" icon={Calculator}>
        <div className="space-y-4">
          <Field label="Картын нэр">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Жишээ: Цэвэр ашиг" className="dash-input" />
          </Field>

          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <label className="text-xs font-bold text-slate-600 block">Томьёо</label>
            <select value={aId} onChange={e => setAId(e.target.value)} className="dash-input">
              {allCards.map(c => <option key={c.id} value={c.id}>{c.deptName} · {c.label} = {fmt(computeValue(c))}</option>)}
            </select>

            <div className="grid grid-cols-4 gap-2">
              {['+', '-', '*', '/'].map(o => (
                <button key={o} onClick={() => setOp(o)}
                        className={`py-2.5 rounded-lg text-lg font-bold transition-all ${op === o
                          ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-md'
                          : 'bg-white border border-slate-200 text-slate-600 hover:border-pink-300'}`}>
                  {o === '*' ? '×' : o === '/' ? '÷' : o}
                </button>
              ))}
            </div>

            <select value={bId} onChange={e => setBId(e.target.value)} className="dash-input">
              {allCards.map(c => <option key={c.id} value={c.id}>{c.deptName} · {c.label} = {fmt(computeValue(c))}</option>)}
            </select>

            <div className="bg-white rounded-lg p-3 border border-slate-200">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Урьдчилан харах</div>
              <div className="text-xs text-slate-500 mb-1 font-mono break-all">
                {fmt(av)} {op === '*' ? '×' : op === '/' ? '÷' : op} {fmt(bv)} =
              </div>
              <div className="text-2xl font-bold text-slate-800">{fmt(result)} {unit}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Нэгж">
              <input value={unit} onChange={e => setUnit(e.target.value)} placeholder="₮ / ш / %" className="dash-input" />
            </Field>
            <Field label="Өнгө">
              <select value={gradientId} onChange={e => setGradientId(e.target.value)} className="dash-input">
                {GRADIENTS.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </Field>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Цуцлах</button>
            <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-pink-500 to-orange-500 text-white text-sm font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-1.5">
              <Save className="w-4 h-4" /> Үүсгэх
            </button>
          </div>
        </div>
      </Modal>
    );
  };

  // ====== ШИНЭ КАРТ ҮҮСГЭХ МОДАЛ ======
  const CreateCardModal = ({ deptId, onClose }) => {
    const [form, setForm] = useState({
      label: '', initialValue: '', unit: '',
      gradientId: 'pink', trend: 0, target: ''
    });
    const handleSave = () => {
      if (!form.label.trim()) { alert('Картын нэр оруулна уу'); return; }
      addCard(deptId, {
        label: form.label.toUpperCase(),
        initialValue: form.initialValue,
        unit: form.unit,
        gradientId: form.gradientId,
        trend: form.trend === '' ? null : Number(form.trend),
        target: form.target ? Number(form.target) : null
      });
      onClose();
    };
    return (
      <Modal onClose={onClose} title="Шинэ карт нэмэх" icon={Plus}>
        <div className="space-y-3">
          <Field label="Картын нэр">
            <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Жишээ: Шинэ хэрэглэгч" className="dash-input" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Өнөөдрийн утга" hint="Хоосон үлдээж бас болно"><input type="number" value={form.initialValue} onChange={e => setForm({ ...form, initialValue: e.target.value })} placeholder="0" className="dash-input" /></Field>
            <Field label="Нэгж"><input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="₮ / ш / %" className="dash-input" /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Тренд (%)"><input type="number" value={form.trend} onChange={e => setForm({ ...form, trend: e.target.value })} className="dash-input" /></Field>
            <Field label="Зорилго (заавал биш)"><input type="number" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} className="dash-input" /></Field>
          </div>
          <Field label="Өнгө">
            <div className="grid grid-cols-6 gap-2">
              {GRADIENTS.map(g => (
                <button key={g.id} onClick={() => setForm({ ...form, gradientId: g.id })}
                        className={`h-10 rounded-lg bg-gradient-to-br ${g.cls} ${form.gradientId === g.id ? 'ring-2 ring-offset-2 ring-pink-500' : 'opacity-70 hover:opacity-100'}`}
                        title={g.name}></button>
              ))}
            </div>
          </Field>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Цуцлах</button>
            <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-pink-500 to-orange-500 text-white text-sm font-bold shadow-md flex items-center justify-center gap-1.5">
              <Save className="w-4 h-4" /> Хадгалах
            </button>
          </div>
        </div>
      </Modal>
    );
  };

  // ====== ЗАСВАРЛАХ МОДАЛ ======
  const EditCardModal = ({ deptId, cardId, onClose }) => {
    const card = departments.find(d => d.id === deptId)?.cards.find(c => c.id === cardId);
    const [form, setForm] = useState({
      label: card?.label || '', unit: card?.unit || '',
      gradientId: card?.gradientId || 'pink',
      trend: card?.trend ?? 0, target: card?.target ?? ''
    });
    if (!card) return null;
    const isFormula = !!card.formula;
    const aggregated = computeValue(card);
    const handleSave = () => {
      updateCard(deptId, cardId, {
        label: form.label.toUpperCase(),
        unit: form.unit,
        gradientId: form.gradientId,
        trend: form.trend === '' ? null : Number(form.trend),
        target: form.target === '' ? null : Number(form.target)
      });
      onClose();
    };
    return (
      <Modal onClose={onClose} title="Карт засварлах" icon={Edit2}>
        <div className="space-y-3">
          <Field label="Картын нэр">
            <input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} className="dash-input" />
          </Field>

          <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
              {isFormula ? 'Тооцоолсон утга' : `Сонгосон period-ийн нийлбэр (${period})`}
            </div>
            <div className="text-2xl font-bold text-slate-800">{fmt(aggregated)} <span className="text-sm text-slate-500">{form.unit}</span></div>
            {!isFormula && (
              <div className="text-[10px] text-pink-500 mt-1">
                ƒ Утгыг шууд засварлах боломжгүй. "ТОО ОРУУЛАХ" товчийг ашиглаарай.
              </div>
            )}
          </div>

          <Field label="Нэгж"><input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="dash-input" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Тренд (%)"><input type="number" value={form.trend} onChange={e => setForm({ ...form, trend: e.target.value })} className="dash-input" /></Field>
            <Field label="Зорилго"><input type="number" value={form.target} onChange={e => setForm({ ...form, target: e.target.value })} className="dash-input" /></Field>
          </div>
          <Field label="Өнгө">
            <div className="grid grid-cols-6 gap-2">
              {GRADIENTS.map(g => (
                <button key={g.id} onClick={() => setForm({ ...form, gradientId: g.id })}
                        className={`h-10 rounded-lg bg-gradient-to-br ${g.cls} ${form.gradientId === g.id ? 'ring-2 ring-offset-2 ring-pink-500' : 'opacity-70 hover:opacity-100'}`}
                        title={g.name}></button>
              ))}
            </div>
          </Field>
          {isFormula && (
            <div className="bg-slate-50 rounded-lg p-3 text-xs">
              <div className="font-bold text-slate-500 mb-1">ТООЦООНЫ ТОМЬЁО</div>
              <div className="font-mono text-slate-700">
                {allCards.find(c => c.id === card.formula.aId)?.label}{' '}
                {card.formula.op === '*' ? '×' : card.formula.op === '/' ? '÷' : card.formula.op}{' '}
                {allCards.find(c => c.id === card.formula.bId)?.label}
              </div>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Цуцлах</button>
            <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-pink-500 to-orange-500 text-white text-sm font-bold shadow-md flex items-center justify-center gap-1.5">
              <Save className="w-4 h-4" /> Хадгалах
            </button>
          </div>
        </div>
      </Modal>
    );
  };

  // ====== ӨДРИЙН ТОО ОРУУЛАХ МОДАЛ ======
  const DailyEntryModal = ({ deptId, onClose }) => {
    const dept = departments.find(d => d.id === deptId);
    const editableCards = dept?.cards.filter(c => !c.formula) || [];

    const [date, setDate] = useState(todayStr());
    const buildValues = (newDate) => {
      const v = {};
      editableCards.forEach(c => { v[c.id] = c.dailyValues?.[newDate] ?? ''; });
      return v;
    };
    const [values, setValues] = useState(() => buildValues(date));

    const handleDateChange = (newDate) => {
      setDate(newDate);
      setValues(buildValues(newDate));
    };

    const handleSave = () => {
      saveDailyEntries(deptId, date, values);
      onClose();
    };

    const totalEntered = Object.values(values).filter(v => v !== '' && v !== null && Number(v) !== 0).length;

    return (
      <Modal onClose={onClose} title={`Өдрийн тоо оруулах · ${dept?.name}`} icon={ClipboardList} maxWidth="max-w-lg">
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-pink-50 to-orange-50 rounded-xl p-4 border border-pink-100">
            <Field label="Огноо сонгох">
              <input type="date" value={date} onChange={e => handleDateChange(e.target.value)} className="dash-input" max={todayStr()} />
            </Field>
            <div className="text-[10px] text-slate-500 mt-2">
              Сонгосон огнооны өдөр оруулсан утга байвал автоматаар ачаалагдана. Хоосон үлдээвэл тухайн өдрийн утга устана.
            </div>
          </div>

          <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-1">
            {editableCards.length === 0 ? (
              <div className="text-center py-6 text-sm text-slate-400">Утга оруулах карт байхгүй байна</div>
            ) : editableCards.map(card => {
              const grad = gradById(card.gradientId);
              return (
                <div key={card.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-pink-300 transition-colors">
                  <div className={`w-1.5 self-stretch rounded-full bg-gradient-to-b ${grad.cls}`}></div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-700 truncate">{card.label}</div>
                    <div className="text-[10px] text-slate-400">{card.unit ? `Нэгж: ${card.unit}` : 'Нэгжгүй'}</div>
                  </div>
                  <input
                    type="number"
                    value={values[card.id]}
                    onChange={e => setValues({ ...values, [card.id]: e.target.value })}
                    placeholder="0"
                    className="dash-input w-32 text-right font-bold text-slate-800"
                  />
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-xs px-2">
            <span className="text-slate-500">Бөглөсөн: <span className="font-bold text-slate-800">{totalEntered}/{editableCards.length}</span></span>
            <span className="text-slate-400">{date}</span>
          </div>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Цуцлах</button>
            <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-pink-500 to-orange-500 text-white text-sm font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-1.5">
              <Save className="w-4 h-4" /> Хадгалах
            </button>
          </div>
        </div>
      </Modal>
    );
  };

  // ====== ТООЦОО ТУЛГАХ МОДАЛ ======
  const ReconcileModal = ({ onClose }) => {
    const [date, setDate] = useState(todayStr());
    const [label, setLabel] = useState('');
    const [items, setItems] = useState([]); // [{productId, qty}]
    const [notes, setNotes] = useState('');
    const [deductedStock, setDeductedStock] = useState(true);
    const [useCostPrice, setUseCostPrice] = useState(false); // зарах эсвэл өртөг үнээр

    const enrichedItems = items.map(it => {
      const p = products.find(pr => pr.id === it.productId);
      if (!p) return null;
      const unitPrice = useCostPrice ? p.costPrice : p.salePrice;
      return {
        productId: p.id,
        productName: p.name,
        productCode: p.code,
        qty: Number(it.qty) || 0,
        unitPrice,
        lineTotal: (Number(it.qty) || 0) * unitPrice,
        currentStock: p.stock,
        category: p.category
      };
    }).filter(Boolean);

    const totalAmount = enrichedItems.reduce((s, it) => s + it.lineTotal, 0);
    const totalQty    = enrichedItems.reduce((s, it) => s + it.qty, 0);
    const hasInsufficientStock = enrichedItems.some(it => deductedStock && it.qty > it.currentStock);

    const addItem = () => {
      if (products.length === 0) {
        alert('Бараа бүртгэгдээгүй байна. Эхлээд "Бараа нөөц" таб руу очиж бараа нэмнэ үү.');
        return;
      }
      const used = new Set(items.map(i => i.productId));
      const available = products.find(p => !used.has(p.id));
      if (!available) { alert('Бүх бараа сонгогдсон байна'); return; }
      setItems([...items, { productId: available.id, qty: 1 }]);
    };
    const updateItem = (idx, updates) => {
      setItems(items.map((it, i) => i === idx ? { ...it, ...updates } : it));
    };
    const removeItem = (idx) => setItems(items.filter((_, i) => i !== idx));

    const handleSave = () => {
      if (!label.trim()) { alert('Тооцооны нэр оруулна уу'); return; }
      if (items.length === 0) { alert('Дор хаяж нэг бараа сонгоно уу'); return; }
      if (enrichedItems.some(it => it.qty <= 0)) { alert('Тоо хэмжээ 0-ээс их байх ёстой'); return; }
      if (hasInsufficientStock && deductedStock) {
        alert('Зарим барааны нөөц хүрэлцэхгүй байна. Тооцоог хадгалахын тулд тоог багасгах эсвэл "Нөөцөөс хасах"-ыг болиулна уу.');
        return;
      }
      saveReconciliation({
        date, label, items: enrichedItems, totalAmount, notes, deductedStock
      });
      onClose();
    };

    return (
      <Modal onClose={onClose} title="Тооцоо тулгах" icon={Receipt} maxWidth="max-w-2xl">
        <div className="space-y-4">
          {/* Толгой */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Огноо">
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className="dash-input" />
            </Field>
            <Field label="Тооцооны нэр *">
              <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Жишээ: 5-р сарын 4-ний борлуулалт" className="dash-input" />
            </Field>
          </div>

          {/* Үнэ ашиглах төрөл */}
          <div className="bg-slate-50 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 border border-slate-200">
            <div className="flex gap-2">
              <button onClick={() => setUseCostPrice(false)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${!useCostPrice ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600'}`}>
                Зарах үнээр
              </button>
              <button onClick={() => setUseCostPrice(true)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${useCostPrice ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600'}`}>
                Өртөг үнээр
              </button>
            </div>
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
              <input type="checkbox" checked={deductedStock} onChange={e => setDeductedStock(e.target.checked)} className="rounded" />
              Нөөцөөс хасах
            </label>
          </div>

          {/* Барааны жагсаалт */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <div className="bg-slate-50 px-3 py-2 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-700">Бараа</div>
              <button onClick={addItem} disabled={items.length >= products.length}
                      className="text-xs font-bold text-pink-600 hover:text-pink-700 flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed">
                <Plus className="w-3 h-3" /> Мөр нэмэх
              </button>
            </div>

            <div className="max-h-[40vh] overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-slate-400">
                  Мөр нэмэх товчийг дарж бараа оруулна уу
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {items.map((item, idx) => {
                    const enriched = enrichedItems[idx];
                    if (!enriched) return null;
                    const insufficient = deductedStock && enriched.qty > enriched.currentStock;
                    return (
                      <div key={idx} className="p-2.5 hover:bg-pink-50/30">
                        <div className="grid grid-cols-12 gap-2 items-center">
                          <select
                            value={item.productId}
                            onChange={e => updateItem(idx, { productId: e.target.value })}
                            className="col-span-6 dash-input text-xs"
                          >
                            {products.map(p => (
                              <option key={p.id} value={p.id} disabled={items.some((i, j) => j !== idx && i.productId === p.id)}>
                                [{p.code}] {p.name} · {p.stock}ш
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="1"
                            value={item.qty}
                            onChange={e => updateItem(idx, { qty: e.target.value })}
                            className={`col-span-2 dash-input text-xs text-right font-bold ${insufficient ? 'border-rose-400 bg-rose-50' : ''}`}
                            placeholder="Тоо"
                          />
                          <div className="col-span-3 text-right">
                            <div className="text-xs font-bold text-slate-800">{fmt(enriched.lineTotal)}₮</div>
                            <div className="text-[10px] text-slate-400">× {fmt(enriched.unitPrice)}₮</div>
                          </div>
                          <button onClick={() => removeItem(idx)} className="col-span-1 p-1.5 rounded-md hover:bg-rose-50 text-slate-400 hover:text-rose-600">
                            <X className="w-3.5 h-3.5 mx-auto" />
                          </button>
                        </div>
                        {insufficient && (
                          <div className="text-[10px] text-rose-600 mt-1 ml-1">
                            ⚠ Нөөц хүрэлцэхгүй: одоо {enriched.currentStock}ш байна
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Нийт дүн */}
            {items.length > 0 && (
              <div className="bg-gradient-to-r from-pink-50 to-orange-50 px-4 py-3 border-t border-pink-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">НИЙТ ДҮН</div>
                  <div className="text-[10px] text-slate-500">{items.length} төрөл · {totalQty}ш</div>
                </div>
                <div className="text-2xl font-bold text-pink-600">{fmt(totalAmount)} <span className="text-sm">₮</span></div>
              </div>
            )}
          </div>

          <Field label="Тайлбар (заавал биш)">
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows="2"
                      placeholder="Жишээ: Бэлэн мөнгөөр төлсөн" className="dash-input resize-none" />
          </Field>

          <div className="flex gap-2 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Цуцлах</button>
            <button onClick={handleSave} disabled={items.length === 0}
                    className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-pink-500 to-orange-500 text-white text-sm font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
              <CheckCircle2 className="w-4 h-4" /> Тулгаж архивлах
            </button>
          </div>
        </div>
      </Modal>
    );
  };

  // ====== ТООЦОО ХАРАХ МОДАЛ ======
  const ViewReconcileModal = ({ rec, onClose }) => {
    return (
      <Modal onClose={onClose} title={rec.label} icon={Receipt} maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Огноо</div>
              <div className="text-sm font-bold text-slate-800 font-mono">{rec.date}</div>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Барааны төрөл</div>
              <div className="text-sm font-bold text-slate-800">{rec.items.length}</div>
            </div>
            <div className="bg-gradient-to-br from-pink-500 to-orange-500 text-white rounded-xl p-3">
              <div className="text-[10px] font-bold opacity-90 uppercase tracking-wider mb-1">Нийт дүн</div>
              <div className="text-sm font-bold">{fmt(rec.totalAmount)}₮</div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                  <th className="px-3 py-2 text-left">Код</th>
                  <th className="px-3 py-2 text-left">Нэр</th>
                  <th className="px-3 py-2 text-right">Тоо</th>
                  <th className="px-3 py-2 text-right">Үнэ</th>
                  <th className="px-3 py-2 text-right">Дүн</th>
                </tr>
              </thead>
              <tbody>
                {rec.items.map((it, i) => (
                  <tr key={i} className="border-t border-slate-100 text-xs">
                    <td className="px-3 py-2 font-mono text-slate-500">{it.productCode}</td>
                    <td className="px-3 py-2 text-slate-800 font-semibold">{it.productName}</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-700">{it.qty}ш</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmt(it.unitPrice)}₮</td>
                    <td className="px-3 py-2 text-right font-bold text-slate-800">{fmt(it.lineTotal)}₮</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-pink-200 bg-gradient-to-r from-pink-50 to-orange-50 font-bold">
                  <td colSpan={4} className="px-3 py-3 text-right text-pink-700 text-xs uppercase tracking-wider">Нийт:</td>
                  <td className="px-3 py-3 text-right text-pink-700 text-base">{fmt(rec.totalAmount)}₮</td>
                </tr>
              </tbody>
            </table>
          </div>

          {rec.notes && (
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <div className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">Тайлбар</div>
              <div className="text-xs text-slate-700">{rec.notes}</div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-slate-500 px-2">
            <div>{rec.deductedStock && (
              <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Нөөцөөс хасагдсан
              </span>
            )}</div>
            <div>Архивласан: {new Date(rec.archivedAt).toLocaleString('mn-MN')}</div>
          </div>

          <button onClick={onClose} className="w-full py-2.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200">
            Хаах
          </button>
        </div>
      </Modal>
    );
  };

  // ====== БАРАА НЭМЭХ МОДАЛ ======
  const AddProductModal = ({ onClose }) => {
    const [form, setForm] = useState({
      code: '', name: '', category: 'Хүнсний', location: '',
      stock: 0, max: 100, costPrice: 0, salePrice: 0
    });

    const margin = form.salePrice > 0
      ? Math.round(((Number(form.salePrice) - Number(form.costPrice)) / Number(form.salePrice)) * 100)
      : 0;

    const handleSave = () => {
      if (!form.code.trim()) { alert('Дотоод код оруулна уу'); return; }
      if (!form.name.trim()) { alert('Барааны нэр оруулна уу'); return; }
      if (products.some(p => p.code === form.code.trim())) {
        alert('Энэ дотоод код өмнө бүртгэгдсэн байна'); return;
      }
      addProduct({
        code: form.code.trim(),
        name: form.name.trim(),
        category: form.category,
        location: form.location.trim() || '-',
        stock: Number(form.stock) || 0,
        max: Number(form.max) || 100,
        costPrice: Number(form.costPrice) || 0,
        salePrice: Number(form.salePrice) || 0
      });
      onClose();
    };

    return (
      <Modal onClose={onClose} title="Шинэ бараа бүртгэх" icon={Package} maxWidth="max-w-lg">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Дотоод код *" hint="Жишээ: KOFE-AR250">
              <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="SKU / Бар код" className="dash-input font-mono" />
            </Field>
            <Field label="Байршил" hint="Лангуу/тавиурын код">
              <input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} placeholder="А-12" className="dash-input font-mono" />
            </Field>
          </div>

          <Field label="Барааны нэр *">
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Жишээ: Кофе Arabica 250г" className="dash-input" />
          </Field>

          <Field label="Ангилал">
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="dash-input">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          <div className="bg-emerald-50/60 rounded-xl p-4 space-y-3 border border-emerald-100">
            <div className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Үнийн мэдээлэл</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Өртөг үнэ (₮)" hint="Авсан үнэ">
                <input type="number" value={form.costPrice} onChange={e => setForm({ ...form, costPrice: e.target.value })} className="dash-input" />
              </Field>
              <Field label="Зарах үнэ (₮)" hint="Худалдаах үнэ">
                <input type="number" value={form.salePrice} onChange={e => setForm({ ...form, salePrice: e.target.value })} className="dash-input" />
              </Field>
            </div>
            {form.costPrice > 0 && form.salePrice > 0 && (
              <div className="bg-white rounded-lg p-3 flex items-center justify-between">
                <span className="text-xs text-slate-500">Маржин:</span>
                <span className={`text-sm font-bold ${margin > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {margin}% ({(Number(form.salePrice) - Number(form.costPrice)).toLocaleString()}₮)
                </span>
              </div>
            )}
          </div>

          <div className="bg-blue-50/60 rounded-xl p-4 space-y-3 border border-blue-100">
            <div className="text-xs font-bold text-blue-700 uppercase tracking-wider">Нөөцийн мэдээлэл</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Эхлэлтийн нөөц (ширхэг)">
                <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} className="dash-input" />
              </Field>
              <Field label="Хамгийн их нөөц">
                <input type="number" value={form.max} onChange={e => setForm({ ...form, max: e.target.value })} className="dash-input" />
              </Field>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Цуцлах</button>
            <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-pink-500 to-orange-500 text-white text-sm font-bold shadow-md flex items-center justify-center gap-1.5">
              <Save className="w-4 h-4" /> Бүртгэх
            </button>
          </div>
        </div>
      </Modal>
    );
  };

  // ====== БАРАА ОРЛОГДОХ МОДАЛ ======
  const ReceiveStockModal = ({ onClose }) => {
    const [productId, setProductId] = useState(products[0]?.id || '');
    const [qty, setQty] = useState('');
    const [newCostPrice, setNewCostPrice] = useState('');
    const [updateCost, setUpdateCost] = useState(false);
    const [notes, setNotes] = useState('');

    const product = products.find(p => p.id === productId);
    const qtyNum = Number(qty) || 0;
    const newStock = (product?.stock || 0) + qtyNum;
    const newAvailable = product ? Math.min(100, (newStock / product.max) * 100) : 0;

    const handleSave = () => {
      if (!product) { alert('Бараа сонгоно уу'); return; }
      if (qtyNum <= 0) { alert('Орлогдох тоо хэмжээ оруулна уу'); return; }
      receiveStock(productId, qtyNum, updateCost && newCostPrice ? Number(newCostPrice) : null);
      onClose();
    };

    return (
      <Modal onClose={onClose} title="Бараа орлогдох" icon={PackagePlus} maxWidth="max-w-lg">
        <div className="space-y-3">
          {products.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-500">
              Эхлээд бараа бүртгэх хэрэгтэй
            </div>
          ) : (
            <>
              <Field label="Бараа сонгох *">
                <select value={productId} onChange={e => setProductId(e.target.value)} className="dash-input">
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      [{p.code}] {p.name} · одоо {p.stock} ширхэг
                    </option>
                  ))}
                </select>
              </Field>

              {product && (
                <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Одоогийн</div>
                      <div className="text-2xl font-bold text-slate-700">{product.stock}</div>
                    </div>
                    <div className="flex items-center justify-center">
                      <ArrowDownCircle className="w-6 h-6 text-emerald-500" />
                    </div>
                    <div>
                      <div className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider mb-1">Шинэ нөөц</div>
                      <div className="text-2xl font-bold text-emerald-600">{newStock}</div>
                    </div>
                  </div>

                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-emerald-400 to-teal-500 rounded-full transition-all" style={{ width: `${newAvailable}%` }}></div>
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>0</span>
                    <span>Хязгаар: {product.max}</span>
                  </div>
                </div>
              )}

              <Field label="Орлогдох тоо хэмжээ *" hint="Ширхэгээр">
                <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} placeholder="0" className="dash-input text-lg font-bold" autoFocus />
              </Field>

              <div className="bg-amber-50/60 rounded-xl p-3 border border-amber-100">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={updateCost} onChange={e => setUpdateCost(e.target.checked)} className="rounded" />
                  <span className="text-xs font-semibold text-slate-700">Шинэ өртөг үнэ оруулах</span>
                </label>
                {updateCost && (
                  <div className="mt-3 space-y-2">
                    <Field label={`Шинэ өртөг үнэ (одоо: ${product?.costPrice.toLocaleString()}₮)`} hint="Жигнэсэн дунджаар тооцоологдоно">
                      <input type="number" value={newCostPrice} onChange={e => setNewCostPrice(e.target.value)} placeholder="0" className="dash-input" />
                    </Field>
                  </div>
                )}
              </div>

              <Field label="Тайлбар (заавал биш)">
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows="2" placeholder="Жишээ: Нийлүүлэгчээс ирсэн" className="dash-input resize-none" />
              </Field>

              <div className="flex gap-2 pt-2">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">Цуцлах</button>
                <button onClick={handleSave} className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-sm font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-1.5">
                  <PackagePlus className="w-4 h-4" /> Орлого бүртгэх
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    );
  };

  const styles = `.dash-input{width:100%;padding:8px 12px;border-radius:8px;border:1px solid #e2e8f0;font-size:14px;background:white;color:#334155}.dash-input:focus{outline:none;border-color:#f472b6;box-shadow:0 0 0 3px rgba(244,114,182,0.15)}`;

  // Ачаалж байх үед loading дэлгэц
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center shadow-lg shadow-pink-500/30 animate-pulse">
            <BarChart3 className="w-8 h-8 text-white" />
          </div>
          <div className="text-lg font-bold text-slate-800 mb-1">KPI Dashboard</div>
          <div className="text-sm text-slate-500">Өгөгдөл ачаалж байна...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50" style={{ fontFamily: "'Manrope', 'Plus Jakarta Sans', system-ui, sans-serif" }}>
      <style>{styles}</style>
      <div className="max-w-[1400px] mx-auto p-4 md:p-6 space-y-4">

        {/* Дээд самбар */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center shadow-lg shadow-pink-500/30">
              <BarChart3 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-lg font-bold text-slate-800">KPI Dashboard</div>
              <div className="text-xs text-slate-500">Менежментийн хяналтын самбар</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="relative p-2.5 rounded-xl bg-white/80 backdrop-blur hover:bg-white shadow-sm">
              <Bell className="w-4 h-4 text-slate-600" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-pink-500 rounded-full"></span>
            </button>
            <button className="p-2.5 rounded-xl bg-white/80 backdrop-blur hover:bg-white shadow-sm">
              <Settings className="w-4 h-4 text-slate-600" />
            </button>
            <button onClick={handleLogout}
                    title="Гарах"
                    className="px-3 py-2 rounded-xl bg-white/80 backdrop-blur hover:bg-rose-50 hover:text-rose-600 shadow-sm flex items-center gap-2 text-xs font-bold text-slate-600 transition-colors">
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Гарах</span>
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-xs font-bold shadow-md">
                {(profile?.full_name || profile?.email || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block">
                <div className="text-xs font-bold text-slate-700 leading-tight">{profile?.full_name || profile?.email}</div>
                <div className="text-[10px] text-slate-500 flex items-center gap-1">
                  <Shield className="w-2.5 h-2.5" />
                  {profile?.role === 'admin' ? 'Админ' : profile?.role === 'manager' ? 'Менежер' : 'Үзэгч'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Таб солих */}
        <div className="flex gap-2 bg-white/60 backdrop-blur p-1 rounded-2xl shadow-sm w-fit flex-wrap">
          <button onClick={() => setActiveTab('kpi')}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'kpi' ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-md shadow-pink-500/30' : 'text-slate-600'}`}>
            KPI Хяналт
          </button>
          <button onClick={() => setActiveTab('inventory')}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'inventory' ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-md shadow-pink-500/30' : 'text-slate-600'}`}>
            Бараа нөөц
          </button>
          <button onClick={() => setActiveTab('reconcile')}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 ${activeTab === 'reconcile' ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-md shadow-pink-500/30' : 'text-slate-600'}`}>
            <Receipt className="w-4 h-4" /> Тооцоо
          </button>
          <button onClick={() => setActiveTab('report')}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 ${activeTab === 'report' ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white shadow-md shadow-pink-500/30' : 'text-slate-600'}`}>
            <FileText className="w-4 h-4" /> Нэгдсэн тайлан
          </button>
        </div>

        {/* Шүүлтүүр */}
        <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 shadow-sm border border-white">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex flex-wrap gap-2">
              {periods.map(p => (
                <button key={p} onClick={() => setPeriod(p)}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all border ${period === p ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white border-transparent shadow-md shadow-pink-500/30' : 'bg-white text-slate-600 border-slate-200 hover:border-pink-300'}`}>
                  {p}
                </button>
              ))}
            </div>
            <button className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-pink-500 to-orange-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-pink-500/30 hover:shadow-lg">
              <Plus className="w-3.5 h-3.5" /> KPI НЭМЭХ
            </button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {(period === 'Өнөөдөр' || period === '7 хоног') && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <input
                    type="date"
                    value={selectedDay}
                    onChange={e => setSelectedDay(e.target.value)}
                    className="text-xs font-medium text-slate-700 bg-transparent focus:outline-none"
                  />
                </div>
              )}

              {period === 'Сар' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <input
                    type="month"
                    value={selectedDate}
                    onChange={e => setSelectedDate(e.target.value)}
                    className="text-xs font-medium text-slate-700 bg-transparent focus:outline-none"
                  />
                </div>
              )}

              {period === 'Жил' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200">
                  <Calendar className="w-4 h-4 text-slate-500" />
                  <select
                    value={selectedYear}
                    onChange={e => setSelectedYear(e.target.value)}
                    className="text-xs font-medium text-slate-700 bg-transparent focus:outline-none cursor-pointer"
                  >
                    {(() => {
                      const cy = new Date().getFullYear();
                      const years = [];
                      for (let y = cy - 3; y <= cy + 1; y++) years.push(y);
                      return years.map(y => <option key={y} value={String(y)}>{y} он</option>);
                    })()}
                  </select>
                </div>
              )}

              {period === 'Гар' && (
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400">ЭХЛЭХ</span>
                    <input
                      type="date"
                      value={customRange.start}
                      onChange={e => setCustomRange({ ...customRange, start: e.target.value })}
                      className="text-xs font-medium text-slate-700 bg-transparent focus:outline-none"
                    />
                  </div>
                  <span className="text-slate-400">→</span>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200">
                    <span className="text-[10px] font-bold text-slate-400">ДУУСАХ</span>
                    <input
                      type="date"
                      value={customRange.end}
                      onChange={e => setCustomRange({ ...customRange, end: e.target.value })}
                      className="text-xs font-medium text-slate-700 bg-transparent focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {period === 'Өчигдөр' && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-medium text-slate-500">Автомат</span>
                </div>
              )}

              <span className="text-xs font-bold tracking-widest text-pink-500 bg-pink-50 px-2.5 py-1 rounded-md">
                {dateDisplay}
              </span>
            </div>
            <div className="flex gap-1 bg-white p-1 rounded-lg border border-slate-200">
              {views.map(v => (
                <button key={v.name} onClick={() => handleViewClick(v.name)}
                        className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${view === v.name && v.name !== 'Excel' ? 'bg-pink-50 text-pink-600' : 'text-slate-500 hover:text-slate-700'}`}>
                  <v.icon className="w-3.5 h-3.5" />
                  {v.name.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* TAB: KPI Хяналт */}
        {activeTab === 'kpi' && departments.map(dept => (
          <div key={dept.id} className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-white">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 text-pink-500 text-[10px] font-bold tracking-widest mb-1">
                  {dept.icon === 'users' ? <Users className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />} ХЭЛТЭС
                </div>
                <h2 className="text-2xl font-bold text-slate-800">{dept.name}</h2>
              </div>
              {canEdit && (
                <div className="flex items-center gap-2 flex-wrap">
                  <button onClick={() => setFormulaModalDept(dept.id)}
                          className="px-3 py-1.5 rounded-lg bg-white border border-pink-200 text-pink-600 text-xs font-bold flex items-center gap-1.5 hover:bg-pink-50">
                    <Calculator className="w-3.5 h-3.5" /> ТООЦОО НЭМЭХ
                  </button>
                  <button onClick={() => setCreatingDeptId(dept.id)}
                          className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 text-xs font-bold flex items-center gap-1.5 hover:bg-slate-50">
                    <Plus className="w-3.5 h-3.5" /> ШИНЭ КАРТ
                  </button>
                  <button onClick={() => setDailyEntryDeptId(dept.id)}
                          className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-pink-500 to-orange-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-pink-500/30">
                    <ClipboardList className="w-3.5 h-3.5" /> ТОО ОРУУЛАХ
                  </button>
                </div>
              )}
            </div>

            {view === 'Карт' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {dept.cards.map(card => <KPICard key={card.id} deptId={dept.id} card={card} />)}
                {dept.cards.length === 0 && (
                  <div className="col-span-full text-center py-8 text-sm text-slate-400">Карт алга. + ШИНЭ КАРТ дарж нэмэх боломжтой.</div>
                )}
              </div>
            )}

            {view === 'График' && (
              dept.cards.length === 0
                ? <div className="text-center py-8 text-sm text-slate-400">График зурах өгөгдөл алга</div>
                : <DepartmentChart dept={dept} />
            )}
          </div>
        ))}

        {/* TAB: Бараа нөөц */}
        {activeTab === 'inventory' && (
          <>
            {/* Статистик картууд */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {inventoryStats.map((stat, i) => {
                const Icon = stat.icon;
                return (
                  <div key={i} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${stat.gradient} p-5 text-white shadow-lg`}>
                    <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl"></div>
                    <div className="relative">
                      <div className="flex items-start justify-between mb-3">
                        <div className="text-[10px] font-bold tracking-wider opacity-90">{stat.label}</div>
                        <Icon className="w-5 h-5 opacity-80" />
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-bold">{stat.value}</span>
                        <span className="text-xs opacity-80">{stat.unit}</span>
                      </div>
                      <div className="h-px bg-white/40 my-3 w-3/4"></div>
                      <div className="text-[11px] opacity-90">{stat.sub}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Графикууд */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 bg-white/80 backdrop-blur rounded-2xl p-5 shadow-sm border border-white">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Барааны хөдөлгөөн</h3>
                    <p className="text-xs text-slate-500">Сүүлийн 30 хоногийн орлого / зарлага</p>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-pink-500"></div><span className="text-slate-600 font-medium">Орсон</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-cyan-500"></div><span className="text-slate-600 font-medium">Гарсан</span></div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={movementData}>
                    <defs>
                      <linearGradient id="colorIrsen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ec4899" stopOpacity={0.4} /><stop offset="100%" stopColor="#ec4899" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorGarsan" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.4} /><stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: 'white', border: '1px solid #fce7f3', borderRadius: 12, fontSize: 12 }} />
                    <Area type="monotone" dataKey="irsen" stroke="#ec4899" strokeWidth={2.5} fill="url(#colorIrsen)" name="Орсон" />
                    <Area type="monotone" dataKey="garsan" stroke="#06b6d4" strokeWidth={2.5} fill="url(#colorGarsan)" name="Гарсан" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-white/80 backdrop-blur rounded-2xl p-5 shadow-sm border border-white">
                <h3 className="text-lg font-bold text-slate-800 mb-1">Ангилал</h3>
                <p className="text-xs text-slate-500 mb-3">Барааны төрлийн хуваарилалт</p>
                {categoryData.length === 0 ? (
                  <div className="text-center py-8 text-sm text-slate-400">Бараа байхгүй</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={categoryData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={3}>
                          {categoryData.map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'white', border: '1px solid #fce7f3', borderRadius: 12, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="space-y-1.5 mt-2">
                      {categoryData.map((c, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full" style={{ background: c.color }}></div><span className="text-slate-600">{c.name}</span></div>
                          <span className="font-bold text-slate-800">{c.value}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Барааны жагсаалт */}
            <div className="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-white overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Барааны жагсаалт</h3>
                  <p className="text-xs text-slate-500">{filteredProducts.length} бараа олдлоо</p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                    <Search className="w-4 h-4 text-slate-400" />
                    <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Бараа хайх..." className="text-xs bg-transparent focus:outline-none w-40 text-slate-700" />
                  </div>
                  {canEdit && (
                    <>
                      <button onClick={() => setShowReceiveStock(true)} className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-500/30 hover:shadow-lg">
                        <PackagePlus className="w-3.5 h-3.5" /> БАРАА ОРЛОГДОХ
                      </button>
                      <button onClick={() => setShowAddProduct(true)} className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-orange-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-pink-500/30 hover:shadow-lg">
                        <Plus className="w-3.5 h-3.5" /> БАРАА НЭМЭХ
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50/60 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                      <th className="px-5 py-3 text-left">Дотоод код</th>
                      <th className="px-5 py-3 text-left">Бараа</th>
                      <th className="px-5 py-3 text-left">Ангилал</th>
                      <th className="px-5 py-3 text-left">Байршил</th>
                      <th className="px-5 py-3 text-left">Нөөц</th>
                      <th className="px-5 py-3 text-right">Үнэ</th>
                      <th className="px-5 py-3 text-center">Төлөв</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr><td colSpan={8} className="px-5 py-12 text-center text-sm text-slate-400">
                        {searchQuery ? 'Хайлт олдсонгүй' : 'Бараа алга байна. + БАРАА НЭМЭХ дарж бүртгэнэ үү.'}
                      </td></tr>
                    ) : filteredProducts.map((p) => {
                      const status = getStatus(p);
                      const pct = (p.stock / p.max) * 100;
                      const barColor = status === 'out' ? 'bg-rose-500' : status === 'low' ? 'bg-orange-500' : 'bg-emerald-500';
                      const badge = {
                        normal: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Хэвийн' },
                        low:    { bg: 'bg-orange-50',  text: 'text-orange-700',  label: 'Бага' },
                        out:    { bg: 'bg-rose-50',    text: 'text-rose-700',    label: 'Дууссан' }
                      }[status];
                      const margin = p.salePrice > 0 ? Math.round(((p.salePrice - p.costPrice) / p.salePrice) * 100) : 0;
                      return (
                        <tr key={p.id} className="border-t border-slate-100 hover:bg-pink-50/30 transition-colors text-sm">
                          <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{p.code}</td>
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-slate-800">{p.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{p.id}</div>
                          </td>
                          <td className="px-5 py-3.5 text-slate-600">{p.category}</td>
                          <td className="px-5 py-3.5 text-slate-600 font-mono text-xs">{p.location}</td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full ${barColor} rounded-full`} style={{ width: `${Math.min(100, pct)}%` }}></div>
                              </div>
                              <span className="text-xs font-semibold text-slate-700 min-w-[3ch]">{p.stock}/{p.max}</span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <div className="font-bold text-slate-800">{p.salePrice.toLocaleString()}₮</div>
                            <div className="text-[10px] text-slate-400">ө: {p.costPrice.toLocaleString()}₮ · {margin}%</div>
                          </td>
                          <td className="px-5 py-3.5 text-center">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badge.bg} ${badge.text}`}>{badge.label}</span>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {canEdit && (
                              <button
                                onClick={() => deleteProduct(p.id)}
                                className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors"
                                title="Бараа устгах"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Бага нөөцийн анхааруулга */}
            {products.filter(p => getStatus(p) === 'low' || getStatus(p) === 'out').length > 0 && (
              <div className="bg-gradient-to-r from-orange-50 via-rose-50 to-pink-50 rounded-2xl p-5 border border-orange-200/50 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center shadow-md">
                    <AlertCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm">Анхааруулга: Бага / дууссан нөөц</div>
                    <div className="text-xs text-slate-600">
                      {products.filter(p => getStatus(p) === 'low').length} бага, {products.filter(p => getStatus(p) === 'out').length} дууссан бараа дахин захиалга шаардлагатай
                    </div>
                  </div>
                </div>
                <button onClick={() => setShowReceiveStock(true)} className="px-4 py-2 rounded-lg bg-white text-orange-600 text-xs font-bold flex items-center gap-1.5 shadow-sm hover:shadow-md">
                  Орлого бүртгэх <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </>
        )}

        {/* TAB: Тооцоо */}
        {activeTab === 'reconcile' && (() => {
          const totalArchived = reconciliations.length;
          const grandTotal = reconciliations.reduce((s, r) => s + r.totalAmount, 0);
          const totalItems = reconciliations.reduce((s, r) => s + r.items.reduce((ss, i) => ss + i.qty, 0), 0);
          const recsByPeriod = reconciliations.filter(r => isDateInPeriod(r.date));
          const periodTotal = recsByPeriod.reduce((s, r) => s + r.totalAmount, 0);

          return (
            <>
              {/* Тооцооны статистик */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-fuchsia-400 via-pink-500 to-purple-500 p-5 text-white shadow-lg">
                  <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl"></div>
                  <div className="relative">
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-[10px] font-bold tracking-wider opacity-90">АРХИВЛАСАН ТООЦОО</div>
                      <Receipt className="w-5 h-5 opacity-80" />
                    </div>
                    <div className="text-3xl font-bold">{totalArchived}</div>
                    <div className="h-px bg-white/40 my-3 w-3/4"></div>
                    <div className="text-[11px] opacity-90">Нийт бүртгэгдсэн</div>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 p-5 text-white shadow-lg">
                  <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl"></div>
                  <div className="relative">
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-[10px] font-bold tracking-wider opacity-90">НИЙТ ДҮН</div>
                      <DollarSign className="w-5 h-5 opacity-80" />
                    </div>
                    <div className="text-2xl font-bold">{fmt(grandTotal)} <span className="text-sm opacity-80">₮</span></div>
                    <div className="h-px bg-white/40 my-3 w-3/4"></div>
                    <div className="text-[11px] opacity-90">Бүх архивласан тооцоо</div>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 p-5 text-white shadow-lg">
                  <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl"></div>
                  <div className="relative">
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-[10px] font-bold tracking-wider opacity-90">{period.toUpperCase()}-Н ДҮН</div>
                      <Calendar className="w-5 h-5 opacity-80" />
                    </div>
                    <div className="text-2xl font-bold">{fmt(periodTotal)} <span className="text-sm opacity-80">₮</span></div>
                    <div className="h-px bg-white/40 my-3 w-3/4"></div>
                    <div className="text-[11px] opacity-90">{recsByPeriod.length} тооцоо</div>
                  </div>
                </div>

                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-blue-500 p-5 text-white shadow-lg">
                  <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10 blur-2xl"></div>
                  <div className="relative">
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-[10px] font-bold tracking-wider opacity-90">НИЙТ БАРАА</div>
                      <Boxes className="w-5 h-5 opacity-80" />
                    </div>
                    <div className="text-3xl font-bold">{totalItems.toLocaleString()}<span className="text-sm opacity-80">ш</span></div>
                    <div className="h-px bg-white/40 my-3 w-3/4"></div>
                    <div className="text-[11px] opacity-90">Тулгасан бараа</div>
                  </div>
                </div>
              </div>

              {/* Архивласан тооцоонуудын жагсаалт */}
              <div className="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-white overflow-hidden">
                <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800">Архив</h3>
                    <p className="text-xs text-slate-500">{totalArchived} тооцоо хадгалагдсан</p>
                  </div>
                  {canEdit && (
                    <button onClick={() => setShowReconcileModal(true)}
                            className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-orange-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-pink-500/30 hover:shadow-lg">
                      <Plus className="w-3.5 h-3.5" /> ШИНЭ ТООЦОО ТУЛГАХ
                    </button>
                  )}
                </div>

                {reconciliations.length === 0 ? (
                  <div className="px-5 py-16 text-center">
                    <div className="w-16 h-16 mx-auto rounded-full bg-pink-50 flex items-center justify-center mb-3">
                      <Receipt className="w-8 h-8 text-pink-400" />
                    </div>
                    <div className="text-sm font-bold text-slate-700 mb-1">Архив хоосон байна</div>
                    <div className="text-xs text-slate-500 mb-4">Эхний тооцоог бүртгэхийн тулд дээрх товчийг дарна уу</div>
                    <button onClick={() => setShowReconcileModal(true)}
                            className="px-4 py-2 rounded-lg bg-gradient-to-r from-pink-500 to-orange-500 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-md">
                      <Plus className="w-3.5 h-3.5" /> Тооцоо тулгах
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
                    {reconciliations.map(rec => (
                      <div key={rec.id} className="relative group bg-white rounded-xl border border-slate-200 hover:border-pink-300 hover:shadow-md transition-all overflow-hidden">
                        <div className="absolute top-2 right-2 flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity z-10">
                          <button onClick={() => setViewingReconcile(rec)}
                                  className="p-1.5 rounded-md bg-pink-50 hover:bg-pink-100 text-pink-600" title="Харах">
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <button onClick={() => deleteReconciliation(rec.id)}
                                    className="p-1.5 rounded-md bg-rose-50 hover:bg-rose-100 text-rose-600" title="Устгах">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div onClick={() => setViewingReconcile(rec)} className="p-4 cursor-pointer">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="text-[10px] font-mono text-slate-400">{rec.date}</div>
                            {rec.deductedStock && (
                              <span className="text-[9px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                                НӨӨЦӨӨС ХАСАГДСАН
                              </span>
                            )}
                          </div>
                          <div className="font-bold text-slate-800 text-sm mb-1 line-clamp-1">{rec.label}</div>
                          <div className="text-xs text-slate-500 mb-3">
                            {rec.items.length} төрөл · {rec.items.reduce((s,i)=>s+i.qty,0)}ш бараа
                          </div>
                          <div className="flex items-end justify-between">
                            <div>
                              <div className="text-[10px] text-slate-400 uppercase tracking-wider">Нийт</div>
                              <div className="text-lg font-bold bg-gradient-to-r from-pink-500 to-orange-500 bg-clip-text text-transparent">
                                {fmt(rec.totalAmount)}₮
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-slate-300" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          );
        })()}

        {/* TAB: Нэгдсэн тайлан */}
        {activeTab === 'report' && (() => {
          // Сонгосон period дотор багтах огноог жагсаах
          const datesInRange = [];
          if (period === 'Өнөөдөр') datesInRange.push(selectedDay);
          else if (period === 'Өчигдөр') datesInRange.push(yesterdayStr());
          else if (period === '7 хоног') {
            const end = new Date(selectedDay);
            for (let i = 6; i >= 0; i--) datesInRange.push(dateKey(new Date(end.getTime() - i * 86400000)));
          } else if (period === 'Сар') {
            const [y, m] = selectedDate.split('-').map(Number);
            const lastDay = new Date(y, m, 0).getDate();
            for (let d = 1; d <= lastDay; d++) datesInRange.push(`${selectedDate}-${String(d).padStart(2,'0')}`);
          } else if (period === 'Жил') {
            for (let m = 1; m <= 12; m++) {
              const lastDay = new Date(parseInt(selectedYear), m, 0).getDate();
              for (let d = 1; d <= lastDay; d++) datesInRange.push(`${selectedYear}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
            }
          } else if (period === 'Гар') {
            if (customRange.start && customRange.end) {
              const start = new Date(customRange.start);
              const end = new Date(customRange.end);
              for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) datesInRange.push(dateKey(new Date(d)));
            }
          }

          // Жилийн тайланг сараар нэгтгэх (хэт олон огноо болохоос)
          const useMonthGrouping = period === 'Жил';
          const groupedDates = useMonthGrouping
            ? Array.from({length: 12}, (_, i) => `${selectedYear}-${String(i+1).padStart(2,'0')}`)
            : datesInRange;

          const getCardSumForKey = (card, key) => {
            if (card.formula) return computeValue(card); // томьёотой картын тооцоог зөвхөн нийт период дээр харуулна
            const dv = card.dailyValues || {};
            if (useMonthGrouping) {
              return Object.entries(dv).reduce((sum, [d, v]) => d.startsWith(key) ? sum + (Number(v) || 0) : sum, 0);
            }
            return Number(dv[key]) || 0;
          };

          const exportReportToExcel = () => {
            const wb = XLSX.utils.book_new();
            const headers = ['Огноо', ...allCards.map(c => `${c.deptName} · ${c.label}`)];
            const rows = groupedDates.map(key => {
              const row = { 'Огноо': key };
              allCards.forEach(c => {
                row[`${c.deptName} · ${c.label}`] = getCardSumForKey(c, key);
              });
              return row;
            });
            // Total row
            const totals = { 'Огноо': 'НИЙТ' };
            allCards.forEach(c => {
              totals[`${c.deptName} · ${c.label}`] = computeValue(c);
            });
            rows.push(totals);

            const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
            ws['!cols'] = headers.map(() => ({ wch: 18 }));
            XLSX.utils.book_append_sheet(wb, ws, 'Нэгдсэн тайлан');
            XLSX.writeFile(wb, `Tailan_${period}_${new Date().toISOString().split('T')[0]}.xlsx`);
          };

          return (
            <>
              {/* Тайлангийн толгой */}
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 shadow-sm border border-white">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-pink-500 text-[10px] font-bold tracking-widest mb-1">
                      <FileText className="w-3 h-3" /> ХУГАЦАА
                    </div>
                    <h2 className="text-2xl font-bold text-slate-800">{period} тайлан</h2>
                    <p className="text-xs text-slate-500 mt-0.5">{dateDisplay} · {groupedDates.length} {useMonthGrouping ? 'сар' : 'өдөр'}</p>
                  </div>
                  <button onClick={exportReportToExcel}
                          className="px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md hover:shadow-lg">
                    <Download className="w-3.5 h-3.5" /> EXCEL ТАТАХ
                  </button>
                </div>
              </div>

              {/* Хэлтэс тус бүрийн тайлан */}
              {departments.map(dept => {
                const deptTotal = dept.cards.reduce((s, c) => s + computeValue(c), 0);
                return (
                  <div key={dept.id} className="bg-white/80 backdrop-blur rounded-2xl shadow-sm border border-white overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center shadow-md">
                          {dept.icon === 'users' ? <Users className="w-5 h-5 text-white" /> : <DollarSign className="w-5 h-5 text-white" />}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800">{dept.name}</h3>
                          <div className="text-xs text-slate-500">{dept.cards.length} карт</div>
                        </div>
                      </div>
                    </div>

                    {dept.cards.length === 0 ? (
                      <div className="p-8 text-center text-sm text-slate-400">Карт алга</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50/60 text-[10px] font-bold tracking-wider text-slate-500 uppercase">
                              <th className="px-4 py-3 text-left sticky left-0 bg-slate-50/60 z-10 min-w-[110px]">{useMonthGrouping ? 'Сар' : 'Огноо'}</th>
                              {dept.cards.map(c => {
                                const grad = gradById(c.gradientId);
                                return (
                                  <th key={c.id} className="px-3 py-3 text-right whitespace-nowrap min-w-[120px]">
                                    <div className="flex items-center justify-end gap-1.5">
                                      <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${grad.cls}`}></div>
                                      <span className="truncate max-w-[110px]" title={c.label}>{c.label}</span>
                                    </div>
                                  </th>
                                );
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {groupedDates.length === 0 ? (
                              <tr><td colSpan={dept.cards.length + 1} className="px-4 py-8 text-center text-slate-400 text-xs">Сонгосон period дотор өдөр алга</td></tr>
                            ) : groupedDates.map(key => {
                              const isToday = key === todayStr();
                              return (
                                <tr key={key} className={`border-t border-slate-100 hover:bg-pink-50/30 ${isToday ? 'bg-pink-50/40' : ''}`}>
                                  <td className={`px-4 py-2.5 sticky left-0 ${isToday ? 'bg-pink-50/80' : 'bg-white/80'} font-mono text-xs ${isToday ? 'text-pink-600 font-bold' : 'text-slate-600'}`}>
                                    {useMonthGrouping
                                      ? `${key.split('-')[1]}-р сар`
                                      : key
                                    }
                                    {isToday && <span className="ml-1 text-[9px] bg-pink-500 text-white px-1 rounded">ӨНӨӨДӨР</span>}
                                  </td>
                                  {dept.cards.map(c => {
                                    const v = getCardSumForKey(c, key);
                                    return (
                                      <td key={c.id} className="px-3 py-2.5 text-right tabular-nums">
                                        {v === 0 ? <span className="text-slate-300">—</span> : <span className="font-semibold text-slate-700">{fmt(v)}</span>}
                                      </td>
                                    );
                                  })}
                                </tr>
                              );
                            })}
                            {/* Total row */}
                            <tr className="border-t-2 border-pink-200 bg-gradient-to-r from-pink-50/80 to-orange-50/80 font-bold">
                              <td className="px-4 py-3 sticky left-0 bg-gradient-to-r from-pink-50/80 to-pink-50/80 text-pink-700 text-xs uppercase tracking-wider">Нийт</td>
                              {dept.cards.map(c => {
                                const total = computeValue(c);
                                return (
                                  <td key={c.id} className="px-3 py-3 text-right tabular-nums text-slate-800">
                                    {fmt(total)} <span className="text-[10px] text-slate-500 ml-0.5">{c.unit}</span>
                                  </td>
                                );
                              })}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Нэгтгэсэн дүгнэлт */}
              <div className="bg-gradient-to-br from-pink-500 via-rose-500 to-orange-500 rounded-2xl p-6 text-white shadow-lg">
                <div className="flex items-center gap-2 text-[10px] font-bold tracking-widest opacity-90 mb-2">
                  <Sigma className="w-3 h-3" /> ЕРӨНХИЙ ДҮГНЭЛТ · {period}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {departments.map(dept => {
                    const total = dept.cards.filter(c => !c.formula).reduce((s, c) => s + computeValue(c), 0);
                    const filled = dept.cards.filter(c => !c.formula).reduce((s, c) => s + Object.keys(c.dailyValues || {}).filter(k => isDateInPeriod(k)).length, 0);
                    return (
                      <div key={dept.id}>
                        <div className="text-[10px] opacity-80 font-bold tracking-wider mb-1">{dept.name.toUpperCase()}</div>
                        <div className="text-xl font-bold">{fmt(total)}</div>
                        <div className="text-[10px] opacity-75 mt-1">{filled} өдрийн бичилт</div>
                      </div>
                    );
                  })}
                  <div>
                    <div className="text-[10px] opacity-80 font-bold tracking-wider mb-1">КАРТ</div>
                    <div className="text-xl font-bold">{allCards.length}</div>
                    <div className="text-[10px] opacity-75 mt-1">{allCards.filter(c => c.formula).length} тооцоонтой</div>
                  </div>
                </div>
              </div>
            </>
          );
        })()}

        <div className="text-center text-xs text-slate-400 pt-4 pb-2">© {new Date().getFullYear()} KPI Dashboard · Бүх эрх хуулиар хамгаалагдсан</div>
      </div>

      {/* Модалууд */}
      {editingCard && <EditCardModal deptId={editingCard.deptId} cardId={editingCard.cardId} onClose={() => setEditingCard(null)} />}
      {creatingDeptId && <CreateCardModal deptId={creatingDeptId} onClose={() => setCreatingDeptId(null)} />}
      {formulaModalDept && <FormulaModal deptId={formulaModalDept} onClose={() => setFormulaModalDept(null)} />}
      {dailyEntryDeptId && <DailyEntryModal deptId={dailyEntryDeptId} onClose={() => setDailyEntryDeptId(null)} />}
      {showAddProduct && <AddProductModal onClose={() => setShowAddProduct(false)} />}
      {showReceiveStock && <ReceiveStockModal onClose={() => setShowReceiveStock(false)} />}
      {showReconcileModal && <ReconcileModal onClose={() => setShowReconcileModal(false)} />}
      {viewingReconcile && <ViewReconcileModal rec={viewingReconcile} onClose={() => setViewingReconcile(null)} />}

      {/* Устгах баталгаажуулах модал */}
      {confirmingDelete && (
        <Modal onClose={() => setConfirmingDelete(null)} title="Карт устгах" icon={Trash2}>
          <div className="space-y-4">
            <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-slate-800 text-sm mb-1">Та итгэлтэй байна уу?</div>
                  <div className="text-xs text-slate-600">
                    "<span className="font-bold">{confirmingDelete.label}</span>" картыг устгана. Энэ үйлдлийг буцаах боломжгүй.
                  </div>
                </div>
              </div>
            </div>
            {confirmingDelete.dependents && confirmingDelete.dependents.length > 0 && (
              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
                <div className="text-xs font-bold text-amber-700 mb-1.5 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Дараах {confirmingDelete.dependents.length} тооцооны карт алдаатай гарна:
                </div>
                <ul className="text-xs text-slate-700 space-y-0.5 pl-5 list-disc">
                  {confirmingDelete.dependents.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => setConfirmingDelete(null)} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                Цуцлах
              </button>
              <button onClick={confirmDeleteCard} className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-rose-500 to-rose-600 text-white text-sm font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-1.5">
                <Trash2 className="w-4 h-4" /> Устгах
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Бараа устгах баталгаажуулах модал */}
      {confirmingProductDelete && (
        <Modal onClose={() => setConfirmingProductDelete(null)} title="Бараа устгах" icon={Trash2}>
          <div className="space-y-4">
            <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-slate-800 text-sm mb-1">Та итгэлтэй байна уу?</div>
                  <div className="text-xs text-slate-600 mb-2">
                    Дараах барааг бүртгэлээс бүрмөсөн устгах гэж байна. Энэ үйлдлийг буцаах боломжгүй.
                  </div>
                  <div className="bg-white rounded-lg p-2.5 border border-rose-200 text-xs space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Дотоод код:</span>
                      <span className="font-mono font-bold text-slate-700">{confirmingProductDelete.code}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Нэр:</span>
                      <span className="font-bold text-slate-800">{confirmingProductDelete.name}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmingProductDelete(null)} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                Цуцлах
              </button>
              <button onClick={confirmDeleteProduct} className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-rose-500 to-rose-600 text-white text-sm font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-1.5">
                <Trash2 className="w-4 h-4" /> Устгах
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Тооцоо устгах баталгаажуулах модал */}
      {confirmingReconcileDelete && (
        <Modal onClose={() => setConfirmingReconcileDelete(null)} title="Тооцоо устгах" icon={Trash2}>
          <div className="space-y-4">
            <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-rose-600" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-slate-800 text-sm mb-1">Архиваас устгах уу?</div>
                  <div className="text-xs text-slate-600 mb-2">
                    Энэ тооцооны бичлэгийг архиваас бүрмөсөн устгана. Хасагдсан нөөц <span className="font-bold">буцаж нэмэгдэхгүй</span>.
                  </div>
                  <div className="bg-white rounded-lg p-2.5 border border-rose-200 text-xs space-y-0.5">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Огноо:</span>
                      <span className="font-mono font-bold text-slate-700">{confirmingReconcileDelete.date}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Нэр:</span>
                      <span className="font-bold text-slate-800">{confirmingReconcileDelete.label}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Нийт дүн:</span>
                      <span className="font-bold text-pink-600">{fmt(confirmingReconcileDelete.totalAmount)}₮</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmingReconcileDelete(null)} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50">
                Цуцлах
              </button>
              <button onClick={confirmDeleteReconciliation} className="flex-1 py-2.5 rounded-lg bg-gradient-to-r from-rose-500 to-rose-600 text-white text-sm font-bold shadow-md hover:shadow-lg flex items-center justify-center gap-1.5">
                <Trash2 className="w-4 h-4" /> Устгах
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
