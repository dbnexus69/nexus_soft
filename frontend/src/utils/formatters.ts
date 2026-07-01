export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0
  }).format(amount);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '-';
  
  const dateOnlyMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    const hasMidnightTime = !dateStr.includes('T') || dateStr.includes('T00:00:00');
    if (hasMidnightTime) {
      const y = parseInt(dateOnlyMatch[1], 10);
      const m = parseInt(dateOnlyMatch[2], 10);
      const d = parseInt(dateOnlyMatch[3], 10);
      return new Date(y, m - 1, d).toLocaleDateString('es-CO');
    }
  }

  const date = new Date(dateStr);
  return date.toLocaleDateString('es-CO');
}

export function formatDateTime(dateStr: string): string {
  if (!dateStr) return '-';
  
  const dateOnlyMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    const hasMidnightTime = !dateStr.includes('T') || dateStr.includes('T00:00:00');
    if (hasMidnightTime) {
      const y = parseInt(dateOnlyMatch[1], 10);
      const m = parseInt(dateOnlyMatch[2], 10);
      const d = parseInt(dateOnlyMatch[3], 10);
      return new Date(y, m - 1, d).toLocaleString('es-CO', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: true
      });
    }
  }

  const date = new Date(dateStr);
  return date.toLocaleString('es-CO', { 
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: true 
  });
}

export function formatDateInput(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function todayStr(): string {
  return formatDateInput(new Date());
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function generateId(array: { id: number }[]): number {
  return array.length > 0 ? Math.max(...array.map(i => i.id)) + 1 : 1;
}

export function getDaysUntil(dateStr: string): number {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  const diff = date.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getCurrentMonth(): { start: string; end: string } {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  
  const formatLocal = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}/${m}/${day}`;
  };

  return {
    start: formatLocal(start),
    end: formatLocal(end)
  };
}

export function capitalizeName(str: string): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function formatSaleId(id: number | string): string {
  return String(id).padStart(4, '0');
}

export function formatId(id: number | string): string {
  return String(id).padStart(4, '0');
}

export function formatMealPlan(plan: string): string {
  if (!plan) return '-';
  const plans: Record<string, string> = {
    'solo_desayuno': 'Solo Desayuno',
    'media_pension': 'Media Pensión',
    'todo_incluido': 'Todo Incluido',
    'full': 'Pensión Completa',
    'sin_alimentacion': 'Solo Alojamiento'
  };
  return plans[plan] || plan;
}

export function getAvatarGradient(name: string): string {
  if (!name) return "from-slate-500 to-slate-400 text-white";
  const char = name.trim().charAt(0).toUpperCase();
  const code = char.charCodeAt(0);
  const presets = [
    "from-[#2B2D42] to-[#8D99AE] text-white",
    "from-indigo-600 to-blue-500 text-white",
    "from-emerald-500 to-teal-400 text-white",
    "from-violet-600 to-fuchsia-500 text-white",
    "from-rose-500 to-pink-500 text-white",
    "from-amber-500 to-yellow-400 text-white",
    "from-cyan-500 to-blue-400 text-white"
  ];
  return presets[code % presets.length];
}
