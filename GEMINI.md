# SIMPL - Enterprise Management System (EMS)

**SIMPL** is a subscription-based Enterprise Management System designed to streamline operations for businesses ranging from SMEs (UMKM) to larger enterprises. It integrates Point of Sales (POS), advanced Inventory Management, Customer Relationship Management (CRM/CMS), and Human Resources (HR/EMS) into a single, cohesive platform. with the main language in indonesia

## 🛠️ Tech Stack & Architecture
* **Frontend:** React.js (Recommended: TypeScript with Tailwind CSS to easily replicate the clean, data-dense design language).
* **Backend:** Golang (Recommended: Gin or Fiber framework for high-performance REST APIs).
* **Database:** PostgreSQL (Ideal for relational data like transactions, inventory tracking, and user schemas).

## 🎨 UI/UX Design Language (Azure-Inspired)
The interface will follow a Microsoft Azure-like aesthetic:
* **Color Palette:** Deep Green (#21AC3A), crisp whites, and cool grays.
* **Layout:** A persistent left-hand navigation menu (sidebar) with collapsable groups, top-level breadcrumbs, and a dashboard heavily utilizing modular cards and data grids.
* **Typography:** Clean, sans-serif fonts (like Segoe UI or Inter) optimized for readability in data-heavy tables.

---

## 💳 Subscription Packages & Features

### 1. UMKM Package - Rp 29.000 / month
*Designed for small to medium businesses needing robust sales and inventory tracking.*

**Core Modules:**
* **Point of Sales (POS) System:**
  * Real-time checkout interface interacting directly with inventory.
  * Sales data recording and receipt generation.
* **Stock Management System:**
  * SKU mapping, detailed item descriptions, and categorization.
  * **Item Movement Tracking:** Full audit trail of stock-in, stock-out, and adjustments.
* **Reporting & Analytics:**
  * Comprehensive views of daily, weekly, and monthly sales and inventory reports.
  * User able to chat with Chatbot connected to MCP to access data from database to retrive what user need

**✨ Special Inventory Features:**
* **Smart Stock Forecasting:** Utilizes the **Welford Algorithm** and data smoothing techniques to calculate rolling variance and mean of historical sales, accurately predicting the required stock for the upcoming month.
* **Dynamic Low-Stock Reminders:** Automatically alerts the owner when product stock runs low. 
  * *Logic:* By default, the system triggers a warning when stock drops to **10%** of the original restock quantity. 
  * *Customization:* Users can adjust this percentage threshold globally or per SKU.

---

### 2. Enterprise Package - Rp 149.000 / month
*Designed for scaling businesses that require customer retention and team management tools. Includes EVERYTHING in the UMKM Package, plus:*

**Core Modules:**
* **Customer Management System (CMS):**
  * Store and manage detailed customer profiles and contact information.
  * Track individual user purchase history and lifetime value.
  * **Targeted Promotions:** Assign specific discounts or pricing tiers to specific users (e.g., VIP members, wholesale partners).
* **Employee Management System (EMS):**
  * Centralized database for employee information and roles.
  * **Scheduling System:** Create, assign, and manage employee shifts, ensuring proper floor coverage alongside POS access control.

---
* **Scema/ERD**
title FINAL SIMPL - Enterprise Platform
notation crows-foot
// Eraser.io DBML Syntax

// ==========================================
// CORE & AUTHENTICATION
// ==========================================

users [icon: user, color: green] {
  id uuid pk
  email string [unique]
  phone string
  username string
  password_hash string
  created_at timestamp
  updated_at timestamp
}

businesses [icon: briefcase, color: blue] {
  id uuid pk
  owner_id uuid
  name string
  created_at timestamp
  updated_at timestamp
  deleted_at timestamp
}

branches [icon: git-branch, color: cyan] {
  id uuid pk
  business_id uuid
  name string
  address string
  created_at timestamp
}

roles [icon: shield, color: green] {
  id uuid pk
  name string // owner | co-owner | cashier | warehouse | hr
}

business_members [icon: users, color: orange] {
  id uuid pk
  business_id uuid
  branch_id uuid // null = all branches / global
  user_id uuid
  role_id uuid
  created_at timestamp
}

// ==========================================
// SUBSCRIPTIONS & BILLING
// ==========================================

plans [icon: tag, color: purple] {
  id string pk // umkm_monthly | umkm_yearly | enterprise
  name string
  price_idr bigint
  features json
}

subscriptions [icon: credit-card, color: red] {
  id uuid pk
  business_id uuid
  plan_id string
  status string // active | expired | canceled | pending
  snap_token_midtrans string // for Midtrans checkout flow
  current_period_end timestamp
  created_at timestamp
  updated_at timestamp
}

// ==========================================
// INVENTORY & PRODUCT CATALOG
// ==========================================

products [icon: package, color: yellow] {
  id uuid pk
  business_id uuid
  name string
  sku string
  cost_price_idr bigint
  selling_price_idr bigint
  low_stock_threshold int
  created_at timestamp
  updated_at timestamp
}

branch_inventory [icon: archive, color: yellow] {
  id uuid pk
  branch_id uuid
  product_id uuid
  current_stock int
  updated_at timestamp
}

stock_movements [icon: repeat, color: yellow] {
  id uuid pk
  branch_id uuid
  product_id uuid
  user_id uuid // actor who triggered it
  qty_change int // + restock/adjustment, - sale
  reason string // sale | restock | adjustment | return | po_receive
  created_at timestamp
}

// ==========================================
// POS & TRANSACTIONS
// ==========================================

orders [icon: shopping-cart, color: emerald] {
  id uuid pk
  business_id uuid
  branch_id uuid
  cashier_id uuid // user_id
  customer_id uuid // null = guest customer
  order_number string
  total_amount_idr bigint
  discount_amount_idr bigint
  payment_method string // cash | qris | midtrans
  payment_status string // paid | refunded
  created_at timestamp
}

order_items [icon: list, color: emerald] {
  id uuid pk
  order_id uuid
  product_id uuid
  qty int
  unit_price_idr bigint
  subtotal_idr bigint
}

// ==========================================
// CUSTOMER MANAGEMENT & LOYALTY PROGRAM
// ==========================================

customers [icon: user-check, color: teal] {
  id uuid pk
  business_id uuid
  name string
  phone string
  email string
  loyalty_points int
  created_at timestamp
  updated_at timestamp
}

loyalty_rewards [icon: award, color: teal] {
  id uuid pk
  business_id uuid
  name string
  points_required int
  discount_amount_idr bigint
  is_active boolean
  created_at timestamp
}

loyalty_point_logs [icon: gift, color: teal] {
  id uuid pk
  customer_id uuid
  order_id uuid
  points_changed int // positive for earn, negative for redeem
  type string // earned | redeemed | expired
  created_at timestamp
}

// ==========================================
// EMPLOYEE SCHEDULE & ATTENDANCE SYSTEM
// ==========================================

employee_schedules [icon: calendar, color: blue] {
  id uuid pk
  business_member_id uuid
  branch_id uuid
  shift_start timestamp
  shift_end timestamp
  notes string
  created_at timestamp
}

employee_attendances [icon: clock, color: blue] {
  id uuid pk
  business_member_id uuid
  branch_id uuid
  clock_in timestamp
  clock_out timestamp
  status string // present | late | absent | leave
  created_at timestamp
}

// ==========================================
// DISTRIBUTOR MANAGEMENT SYSTEM (DMS)
// ==========================================

suppliers [icon: truck, color: orange] {
  id uuid pk
  business_id uuid
  name string
  contact_person string
  phone string
  email string
  address string
  created_at timestamp
}

purchase_orders [icon: file-text, color: orange] {
  id uuid pk
  business_id uuid
  branch_id uuid
  supplier_id uuid
  created_by_user_id uuid
  po_number string
  status string // draft | ordered | received | cancelled
  total_cost_idr bigint
  created_at timestamp
  updated_at timestamp
}

purchase_order_items [icon: check-square, color: orange] {
  id uuid pk
  purchase_order_id uuid
  product_id uuid
  qty_ordered int
  qty_received int
  unit_cost_idr bigint
  subtotal_idr bigint
}

// ==========================================
// FORECASTING, SMART PRICING & AI (ABAI / MCP)
// ==========================================

stock_forecasts [icon: trending-up, color: violet] {
  id uuid pk
  branch_id uuid
  product_id uuid
  forecast_date date
  predicted_demand int
  recommended_reorder_qty int
  safety_stock int
  reorder_point int
  algorithm_used string // eoq | sma | ema
  created_at timestamp
}

smart_pricing_rules [icon: dollar-sign, color: violet] {
  id uuid pk
  business_id uuid
  product_id uuid
  min_price_idr bigint
  max_price_idr bigint
  recommended_price_idr bigint
  pricing_strategy string // demand_based | competitor_based | margin_based
  updated_at timestamp
}

ai_chat_logs [icon: cpu, color: pink] {
  id uuid pk
  business_id uuid
  user_id uuid
  user_query string
  generated_sql string
  created_at timestamp
}

// ==========================================
// RELATIONSHIPS
// ==========================================

// Core & Subscriptions
business_members.business_id > businesses.id
business_members.branch_id > branches.id
business_members.user_id > users.id
business_members.role_id > roles.id
businesses.owner_id > users.id
branches.business_id > businesses.id
subscriptions.business_id > businesses.id
subscriptions.plan_id > plans.id

// Inventory
products.business_id > businesses.id
branch_inventory.branch_id > branches.id
branch_inventory.product_id > products.id
stock_movements.branch_id > branches.id
stock_movements.product_id > products.id
stock_movements.user_id > users.id

// Orders & Customers
orders.business_id > businesses.id
orders.branch_id > branches.id
orders.cashier_id > users.id
orders.customer_id > customers.id
order_items.order_id > orders.id
order_items.product_id > products.id
customers.business_id > businesses.id
loyalty_rewards.business_id > businesses.id
loyalty_point_logs.customer_id > customers.id
loyalty_point_logs.order_id > orders.id

// Employees & Scheduling
employee_schedules.business_member_id > business_members.id
employee_schedules.branch_id > branches.id
employee_attendances.business_member_id > business_members.id
employee_attendances.branch_id > branches.id

// Distributor Management System
suppliers.business_id > businesses.id
purchase_orders.business_id > businesses.id
purchase_orders.branch_id > branches.id
purchase_orders.supplier_id > suppliers.id
purchase_orders.created_by_user_id > users.id
purchase_order_items.purchase_order_id > purchase_orders.id
purchase_order_items.product_id > products.id

// AI, Analytics & Smart Pricing
stock_forecasts.branch_id > branches.id
stock_forecasts.product_id > products.id
smart_pricing_rules.business_id > businesses.id
smart_pricing_rules.product_id > products.id
ai_chat_logs.business_id > businesses.id
ai_chat_logs.user_id > users.id