# Palette de couleurs - Inventory Web

## Couleurs principales

### Fond et arrière-plan
- **Fond principal** : `#F8FAFC` (gris très clair)
- **Fond des cartes/sections** : `#FFFFFF` (blanc) avec opacité
  - `bg-white/85` (85% d'opacité)
  - `bg-white/80` (80% d'opacité)
  - `bg-white/95` (95% d'opacité)
- **Fond des cartes secondaires** : `#F8FAFC` (gris très clair)

### Texte
- **Texte principal** : `#111827` (noir/gris très foncé)
- **Texte secondaire** : `#6B7280` (gris moyen)
- **Texte sur fond sombre** : `#FFFFFF` (blanc)

### Boutons et actions
- **Bouton principal** : `#111827` (noir)
- **Bouton principal hover** : `#000000` (noir pur)
- **Bouton secondaire** : `bg-zinc-100` avec `text-[#6B7280]`
- **Bouton secondaire hover** : `bg-zinc-200`

### Bordures
- **Bordure standard** : `border-zinc-200` (gris clair)
- **Bordure focus** : `border-zinc-300` (gris moyen)
- **Bordure blanche** : `border-white/60` ou `border-white/70`

### Statuts des commandes
- **En préparation** :
  - Fond : `bg-orange-100` (#FED7AA)
  - Texte : `text-orange-700` (#C2410C)
  
- **En cours de livraison** :
  - Fond : `bg-blue-100` (#DBEAFE)
  - Texte : `text-blue-700` (#1D4ED8)
  
- **Livrée** :
  - Fond : `bg-green-100` (#D1FAE5)
  - Texte : `text-green-700` (#15803D)

### Alertes
- **Alerte stock bas** :
  - Fond : `bg-red-50/80` (#FEF2F2 avec 80% opacité)
  - Bordure : `border-red-200` (#FECACA)
  - Texte titre : `text-red-900` (#7F1D1D)
  - Texte lien : `text-red-700` (#B91C1C)
  - Texte lien hover : `text-red-900` (#7F1D1D)
  - Texte valeur : `text-red-600` (#DC2626)
  - Texte seuil : `text-red-500` (#EF4444)

### Ombres
- **Ombre standard** : `shadow-[0_24px_70px_rgba(15,23,42,0.1)]`
- **Ombre légère** : `shadow-[0_16px_40px_rgba(15,23,42,0.08)]`
- **Ombre alerte** : `shadow-[0_18px_50px_rgba(239,68,68,0.15)]` (rouge)
- **Ombre hover** : `shadow-[0_24px_70px_rgba(15,23,42,0.15)]`

### Coins arrondis
- **Petit** : `rounded-xl` (12px)
- **Moyen** : `rounded-2xl` (16px)
- **Grand** : `rounded-[24px]` (24px)
- **Très grand** : `rounded-[28px]` (28px)
- **Extra large** : `rounded-[32px]` (32px)

## Palette complète en hexadécimal

```css
/* Couleurs principales */
--color-primary: #111827;        /* Noir/gris foncé - Boutons, texte principal */
--color-primary-hover: #000000;   /* Noir pur - Hover boutons */
--color-background: #F8FAFC;     /* Gris très clair - Fond principal */
--color-card: #FFFFFF;            /* Blanc - Cartes */
--color-text-primary: #111827;    /* Noir/gris foncé - Texte principal */
--color-text-secondary: #6B7280;  /* Gris moyen - Texte secondaire */
--color-text-light: #FFFFFF;      /* Blanc - Texte sur fond sombre */

/* Bordures */
--color-border: #E4E4E7;         /* zinc-200 */
--color-border-light: #F4F4F5;   /* zinc-100 */
--color-border-focus: #D4D4D8;   /* zinc-300 */

/* Statuts */
--color-status-preparation-bg: #FED7AA;    /* orange-100 */
--color-status-preparation-text: #C2410C;  /* orange-700 */
--color-status-delivery-bg: #DBEAFE;      /* blue-100 */
--color-status-delivery-text: #1D4ED8;    /* blue-700 */
--color-status-delivered-bg: #D1FAE5;     /* green-100 */
--color-status-delivered-text: #15803D;   /* green-700 */

/* Alertes */
--color-alert-bg: #FEF2F2;       /* red-50 */
--color-alert-border: #FECACA;   /* red-200 */
--color-alert-text-title: #7F1D1D; /* red-900 */
--color-alert-text-link: #B91C1C;  /* red-700 */
--color-alert-text-value: #DC2626; /* red-600 */
--color-alert-text-threshold: #EF4444; /* red-500 */
```

## Utilisation dans l'application mobile

Pour réutiliser ces couleurs dans votre application mobile, vous pouvez :

1. **Créer un fichier de thème** avec ces couleurs
2. **Utiliser les codes hexadécimaux** directement
3. **Adapter les opacités** selon les besoins de la plateforme mobile

### Exemple pour React Native / Flutter

```javascript
// React Native
const colors = {
  primary: '#111827',
  primaryHover: '#000000',
  background: '#F8FAFC',
  card: '#FFFFFF',
  textPrimary: '#111827',
  textSecondary: '#6B7280',
  textLight: '#FFFFFF',
  border: '#E4E4E7',
  status: {
    preparation: { bg: '#FED7AA', text: '#C2410C' },
    delivery: { bg: '#DBEAFE', text: '#1D4ED8' },
    delivered: { bg: '#D1FAE5', text: '#15803D' },
  },
  alert: {
    bg: '#FEF2F2',
    border: '#FECACA',
    textTitle: '#7F1D1D',
    textLink: '#B91C1C',
    textValue: '#DC2626',
    textThreshold: '#EF4444',
  },
};
```
