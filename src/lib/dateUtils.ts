import { Timestamp } from "firebase/firestore";

/**
 * Convertit un Timestamp Firebase en objet Date
 */
export function timestampToDate(timestamp: Timestamp | undefined): Date | null {
  if (!timestamp) return null;
  return timestamp.toDate();
}

/**
 * Formate une date au format DD/MM/YYYY
 */
export function formatDate(date: Date | Timestamp | undefined): string {
  if (!date) return "-";
  
  const dateObj = date instanceof Timestamp ? date.toDate() : date;
  
  const day = dateObj.getDate().toString().padStart(2, "0");
  const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
  const year = dateObj.getFullYear();
  
  return `${day}/${month}/${year}`;
}

/**
 * Formate une date au format DD/MM/YYYY HH:MM
 */
export function formatDateTime(date: Date | Timestamp | undefined): string {
  if (!date) return "-";
  
  const dateObj = date instanceof Timestamp ? date.toDate() : date;
  
  const day = dateObj.getDate().toString().padStart(2, "0");
  const month = (dateObj.getMonth() + 1).toString().padStart(2, "0");
  const year = dateObj.getFullYear();
  const hours = dateObj.getHours().toString().padStart(2, "0");
  const minutes = dateObj.getMinutes().toString().padStart(2, "0");
  
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Formate une date au format relatif (il y a X jours/heures/minutes)
 */
export function formatRelativeDate(date: Date | Timestamp | undefined): string {
  if (!date) return "-";
  
  const dateObj = date instanceof Timestamp ? date.toDate() : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  
  if (diffMinutes < 1) return "À l'instant";
  if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  
  return formatDate(dateObj);
}

/**
 * Obtient le mois et l'année d'une date
 */
export function getMonthYear(date: Date | Timestamp | undefined): { month: number; year: number } | null {
  if (!date) return null;
  
  const dateObj = date instanceof Timestamp ? date.toDate() : date;
  
  return {
    month: dateObj.getMonth() + 1,
    year: dateObj.getFullYear(),
  };
}

/**
 * Obtient le nom du mois en français
 */
export function getMonthName(monthNumber: number): string {
  const months = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];
  
  return months[monthNumber - 1] || "";
}

/**
 * Filtre les éléments par mois et année
 */
export function filterByMonthYear<T extends { created_at?: Timestamp }>(
  items: T[],
  month: number | null,
  year: number | null
): T[] {
  if (!month && !year) return items;
  
  return items.filter((item) => {
    if (!item.created_at) return false;
    
    const date = item.created_at.toDate();
    const itemMonth = date.getMonth() + 1;
    const itemYear = date.getFullYear();
    
    if (month && year) {
      return itemMonth === month && itemYear === year;
    }
    if (month) {
      return itemMonth === month;
    }
    if (year) {
      return itemYear === year;
    }
    
    return true;
  });
}

/**
 * Obtient la liste des années disponibles dans un tableau de données
 */
export function getAvailableYears<T extends { created_at?: Timestamp }>(items: T[]): number[] {
  const years = new Set<number>();
  
  items.forEach((item) => {
    if (item.created_at) {
      const year = item.created_at.toDate().getFullYear();
      years.add(year);
    }
  });
  
  return Array.from(years).sort((a, b) => b - a);
}

/**
 * Obtient la liste des mois disponibles pour une année donnée
 */
export function getAvailableMonths<T extends { created_at?: Timestamp }>(
  items: T[],
  year: number | null
): number[] {
  const months = new Set<number>();
  
  items.forEach((item) => {
    if (item.created_at) {
      const date = item.created_at.toDate();
      const itemYear = date.getFullYear();
      
      if (!year || itemYear === year) {
        months.add(date.getMonth() + 1);
      }
    }
  });
  
  return Array.from(months).sort((a, b) => a - b);
}

/**
 * Vérifie si une date est aujourd'hui
 */
export function isToday(date: Date | Timestamp | undefined): boolean {
  if (!date) return false;
  
  const dateObj = date instanceof Timestamp ? date.toDate() : date;
  const today = new Date();
  
  return (
    dateObj.getDate() === today.getDate() &&
    dateObj.getMonth() === today.getMonth() &&
    dateObj.getFullYear() === today.getFullYear()
  );
}

/**
 * Vérifie si une date est dans les X derniers jours
 */
export function isWithinLastDays(date: Date | Timestamp | undefined, days: number): boolean {
  if (!date) return false;
  
  const dateObj = date instanceof Timestamp ? date.toDate() : date;
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  
  return diffDays <= days && diffDays >= 0;
}
