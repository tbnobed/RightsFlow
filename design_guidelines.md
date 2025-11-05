# Promissio Rights & Royalties Management Platform - Design Guidelines

## Design Approach
**System Selected**: Modern SaaS Dashboard - Drawing from Linear, Vercel, and Stripe dashboard patterns
**Rationale**: Utility-focused application requiring clarity, efficiency, and professional sophistication for complex data management.

## Typography System
- **Primary Font**: Inter (Google Fonts)
- **Monospace**: JetBrains Mono (for financial data, contract IDs)
- **Hierarchy**:
  - Hero/Display: 4xl-5xl, font-bold
  - Page Titles: 2xl-3xl, font-semibold
  - Section Headers: xl, font-semibold
  - Body Text: base, font-normal
  - Labels/Metadata: sm, font-medium
  - Financial Figures: lg-xl, font-mono, tabular-nums

## Layout System
**Spacing Primitives**: Tailwind units 2, 4, 6, 8, 12, 16
- Component padding: p-4 to p-6
- Section spacing: space-y-8
- Card gaps: gap-4 to gap-6
- Dashboard grid gaps: gap-6

## Component Library

### Navigation Structure
**Sidebar Navigation** (Left, persistent):
- Promissio logo/wordmark (top, p-6)
- Primary nav items with icons: Dashboard, Contracts, Artists, Royalties, Payments, Calendar, Reports, Settings
- User profile section (bottom): Avatar, name, role indicator
- Width: w-64, collapsible to w-16 on smaller screens

**Top Bar**:
- Search bar (global, w-96): "Search contracts, artists, payments..."
- Quick actions: Add Contract, New Payment buttons
- Notification bell with counter badge
- User avatar dropdown

### Dashboard Layout (Main Content Area)
**Hero Section**:
- Full-width container with image background showing abstract financial graphs/data visualization
- Overlay gradient for readability
- Content: "Welcome back, [User Name]" (text-3xl), current period stats overview
- Two CTAs with blurred backgrounds: "New Contract" (primary), "Generate Report" (secondary)
- Height: 40vh to 50vh

**Stats Overview** (Below hero):
- 4-column grid (grid-cols-4, gap-6)
- Cards: Total Active Contracts, Pending Royalties, Expiring This Month, Recent Payments
- Each card: Large number (text-4xl, font-mono), label, percentage change indicator with icon

### Calendar Component (Featured)
**Placement**: Right column of 2-column dashboard grid (2/3 left, 1/3 right)

**Calendar Design**:
- Month view with day cells in grid
- Contract expiration indicators: Dots or small badges on dates
- Color-coded by urgency (without specifying colors): Expired, <7 days, <30 days, >30 days
- Hover reveals contract preview card with: Contract title, artist name, expiration date, renewal status
- Navigation: Month/year switcher, Today button
- Legend showing urgency categories
- "View All Expiring Contracts" link below calendar

### Contract Management Table (Left column)
**Features**:
- Sortable columns: Contract ID, Artist/Rights Holder, Type, Start Date, Expiration, Status, Actions
- Row actions: View, Edit, Renew icons
- Status badges (pill-shaped)
- Filter bar above table: Status dropdown, Date range, Search
- Pagination with page size selector
- Expandable rows showing royalty breakdown

### Dashboard Cards
**Recent Activity Feed**:
- Timeline-style list
- Icons for event types (payment processed, contract signed, expiration warning)
- Timestamp, description, related artist/contract link
- "View All Activity" footer link

**Top Earning Artists** (Card):
- Ranked list with position numbers
- Artist name, total earnings (monospace), trend arrow
- Small sparkline chart for each

**Payment Pipeline** (Card):
- Kanban-style columns: Pending, Processing, Completed
- Payment cards with amount, artist, due date
- Drag-and-drop zones indicated

### Forms & Inputs
- Input fields: Consistent height (h-12), rounded corners, border treatment
- Labels: Above inputs, font-medium, text-sm
- Helper text: text-xs below inputs
- Date pickers: Calendar overlay matching main calendar style
- Dropdowns: Multi-select with tag display
- File uploads: Drag-drop zones for contracts/documents

### Data Visualization
- Line charts for royalty trends over time
- Bar charts for payment comparisons
- Donut charts for revenue distribution by contract type
- All charts: Tooltips on hover, legend, axis labels

## Images

**Hero Section Image**:
- Abstract visualization of financial data streams, network connections, or stylized royalty flow diagrams
- Professional, modern aesthetic - think data visualization art
- Dimensions: 1920x600px minimum
- Purpose: Establish sophisticated, data-driven brand identity
- Placement: Full-width background with gradient overlay

**Empty States** (When applicable):
- Illustration for "No contracts expiring" calendar view
- Icon for "No recent activity"

## Responsive Behavior
- Desktop (1440px+): Full sidebar + 2-column dashboard layout
- Tablet (768px-1440px): Collapsed sidebar (icons only) + single column with stacked calendar
- Mobile (<768px): Hidden sidebar (hamburger menu), stacked single column, simplified calendar (list view)

## Accessibility
- Keyboard navigation for all interactive elements
- ARIA labels for icon-only buttons
- Focus indicators matching UI aesthetic
- Skip navigation link
- Screen reader announcements for calendar date selections

## Animation Guidelines
**Minimal, purposeful only**:
- Sidebar collapse/expand transition
- Card hover lift (subtle)
- Calendar date selection highlight
- Loading states: Skeleton screens (not spinners)