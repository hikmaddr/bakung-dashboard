````md
# ERP Dashboard Enhancement Request

## Project Overview

Kami sedang membangun ERP Dashboard berbasis multi-brand untuk kebutuhan distribusi, procurement, custom order, dan project-based sales.

### Current Stack
- Next.js
- TailwindCSS
- Modern Enterprise Dashboard UI
- Modular Architecture

### UX Direction
Target UX seperti:
- SAP Business One
- Odoo
- Oracle NetSuite
- Jurnal
- Accurate
- Monday ERP Hybrid

---

# Main Improvement Priorities

Need improvement ASAP for:
- Sales workflow
- Procurement workflow
- Build by Order system
- Finance tracking
- Reporting UX
- Internal margin confidentiality
- Cross-document relation system

---

# 1. QUOTATION SYSTEM ENHANCEMENT

## Current Issue
Status quotation masih terlalu sederhana dan belum mendukung operational workflow.

## Required Quotation Status

| Status | Description |
|---|---|
| Draft | Belum dikirim |
| Sent | Sudah dikirim ke client |
| Viewed | Client sudah membuka quotation |
| Approved | Disetujui client |
| Rejected | Ditolak client |
| Expired | Masa berlaku habis |
| Converted | Sudah dikonversi menjadi SO |

---

# APPROVED FLOW REQUIREMENTS

Ketika quotation berubah menjadi APPROVED:

System wajib meminta:
- Upload dokumen dari client:
  - Sales Order (SO)
  - Purchase Order (PO)
  - Support image / PDF / DOC

## Need Approval Confirmation Modal

### Pertanyaan:
Apakah ada negosiasi harga?

Options:
- Yes
- No

Jika YES:
- Open adjustment page
- Track:
  - original quotation value
  - negotiated value
  - margin changes
  - negotiation notes
  - revision history

Need complete audit trail.

---

# 2. SALES ORDER (SO) WORKFLOW ENHANCEMENT

## Business Model
- Build by Order
- Procurement by Request
- Non-stock workflow

Meaning:
Item dari SO TIDAK otomatis masuk stock inventory.

---

# REQUIRED WORKFLOW

```text
Quotation
→ Client Approval
→ Internal SO
→ Supplier Purchase Request
→ Purchase Order
→ Supplier Production
→ QC
→ Shipping
→ Delivery Order / Surat Jalan
→ Invoice
→ Payment
````

---

# SO REQUIREMENTS

## Supplier Relation

SO harus dapat connect ke:

* Single supplier
* Multiple suppliers

---

# Supplier Attachment Support

Need attachment support:

* Supplier quotation
* Supplier invoice
* Aldmic quotation attachment
* Procurement files

---

# SUPPLIER STATUS TRACKING

| Status            | Description             |
| ----------------- | ----------------------- |
| Waiting Supplier  | Menunggu supplier       |
| Supplier Approved | Supplier menerima order |
| DP Paid           | DP sudah dibayar        |
| Production        | Sedang produksi         |
| QC Process        | Sedang QC               |
| Ready Shipment    | Siap dikirim            |
| Shipped           | Sudah dikirim           |
| Delivered         | Barang diterima         |

Need:

* Timeline visualization
* Activity logs
* Operational tracking

---

# DELIVERY ORDER AUTOMATION

Ketika supplier status menjadi:

* Ready Shipment
  atau
* Shipped

System harus dapat:
Generate Delivery Order / Surat Jalan.

---

# DELIVERY ORDER REQUIREMENTS

Need:

* Expedition info
* Driver
* Vehicle
* Receiver PIC
* Proof of delivery upload

---

# IMPORTANT — BUILD BY ORDER LOGIC

Order seperti ini:

* Project based
* Custom procurement
* Build by order

Products seperti ini TIDAK:

* Menambah stock inventory
* Mengurangi stock warehouse

Need:
`Non Inventory Order` toggle.

---

# 3. FINANCE SYSTEM ENHANCEMENT

## Current Problem

Finance UI/UX masih terlalu sederhana dan hanya seperti transaction list.

Need:

* Operational finance
* Project margin tracking
* Procurement tracking
* Confidential internal costing

---

# INTERNAL COST & SECRET MARGIN SYSTEM

Need hidden internal fields:

| Field                   | Visibility    |
| ----------------------- | ------------- |
| Client Selling Price    | Visible       |
| Supplier Cost           | Internal only |
| Titipan Cost Adjustment | Internal only |
| Hidden Margin           | Internal only |
| Tax Adjustment          | Internal only |

---

# IMPORTANT

Internal fields:

* MUST NEVER appear on:

  * Quotation print
  * Invoice
  * Delivery order
  * Receipt
  * Export PDF

Need:
Strict role-based visibility.

---

# FINANCE TRACKING REQUIREMENTS

Need:

* Gross Profit
* Net Profit
* Per Project Margin
* Per SO Profitability
* Supplier Outstanding
* Client Receivable
* Cashflow Movement
* Expense relation to SO/project

---

# PAYMENT FLOW REQUIREMENTS

Need support:

* DP payment
* Partial payment
* Installment payment
* Multiple payment methods

Need:
Auto receipt generation after payment confirmation.

---

# 4. REPORT & REKAP UX REDESIGN

## Current Problem

Current reporting page:

* terlalu statis
* sulit dianalisa
* kurang visual hierarchy

Need:
Modern executive dashboard style.

---

# REPORT PAGE REQUIREMENTS

## KPI Cards

Need:

* Revenue
* Gross Profit
* Net Profit
* Outstanding A/R
* Outstanding A/P
* Active Projects
* Pending Deliveries
* Supplier Liabilities

---

# INTERACTIVE FILTERS

Need filters:

* Date range
* Brand
* Supplier
* Client
* Project
* Sales person
* Procurement status
* Payment status

---

# REPORT VISUALIZATION

Need:

* Revenue chart
* Profit chart
* Cashflow chart
* Expense distribution
* Supplier spending
* Monthly comparison
* Overdue invoice chart

Use:
Modern enterprise analytics UI.

---

# FINANCE UX IMPROVEMENT

Need:

* Cashflow management
* Account balance monitoring
* Bank reconciliation
* Project profitability
* Internal cost center

---

# UI/UX IMPROVEMENTS

Need:

* Better spacing
* Better information hierarchy
* Cleaner table UI
* Expandable rows
* Sticky filters
* Status chips
* Timeline cards
* Better empty state
* Less empty gray space

---

# 5. SYSTEM RELATIONSHIP REQUIREMENTS

Need fully connected document relation:

```text
Quotation
↔ Client Approval
↔ SO
↔ Purchase Order
↔ Supplier Workflow
↔ Delivery Order
↔ Invoice
↔ Payment
↔ Receipt
```

---

# DOCUMENT RELATION REQUIREMENTS

Every document should show:

* Linked documents
* Statuses
* Timeline
* Attachment history
* Activity history

---

# 6. UI/UX DIRECTION

Need:

* Modern enterprise ERP UI
* Premium SaaS appearance
* Modular card system
* Responsive layout
* Modern tables
* Timeline tracking
* Kanban/progress support

---

# UI REFERENCES

Style reference:

* Linear
* Stripe Dashboard
* SAP Fiori
* Odoo modernized
* Notion database UX
* Monday.com ERP hybrid

---

# QUESTIONS / DISCOVERY NEEDED FROM BUILDER

1. Should SO and Procurement be separated modules?
2. Best approach for Build by Order without stock mutation?
3. Best way to hide internal margins securely?
4. Should finance use account ledger architecture?
5. Recommended structure for project-based profitability?
6. Best workflow for partial delivery + partial invoice?
7. Need recommendation for scalable reporting architecture.
8. Best database relation for multi-brand + multi-project ERP.
9. Recommendation for role permission hierarchy.
10. Best UX approach for enterprise procurement tracking.

---

# EXPECTED OUTPUT

Need:

* UX audit
* Workflow redesign
* Database architecture recommendation
* ERP-grade flow improvement
* UI redesign proposal
* Enterprise finance structure
* Procurement flow optimization
* Scalable reporting architecture
* Better information hierarchy
* Better operational usability

```
```
