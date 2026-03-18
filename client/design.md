🩺 Skin Disease Prediction Platform - Frontend UI Guide
Welcome to the frontend repository for the Skin Disease Prediction Platform.
This document provides setup instructions along with a complete UI design system to maintain a clean, modern, and healthcare-focused user experience.

🚀 Quick Start
Built using React + Vite + Tailwind CSS + React Router + Recharts + Axios

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
🎨 UI Design System & Guidelines
Our application follows a Modern Healthcare UI aesthetic, focusing on:

Clean & minimal design

Soft medical color palette

Trust, clarity, and accessibility

Subtle animations (not flashy)

High readability

🎯 1. Color Palette (Healthcare Theme)
Avoid neon or overly dark themes. Focus on calm, medical-grade colors.

Backgrounds:
bg-medical-base → #f8fafc (light background)

bg-medical-card → #ffffff (cards)

bg-medical-muted → #eef2f7 (sections)

Primary Colors:
primary → #2563eb (blue – trust & reliability)

primary-light → #3b82f6

primary-dark → #1d4ed8

Secondary / Accent:
accent → #10b981 (green – health & safety)

accent-light → #34d399

Alerts:
Red → #ef4444 (high risk)

Yellow → #f59e0b (moderate risk)

Green → #22c55e (low risk)

Borders:
border-gray-200

border-gray-300

✍️ 2. Typography
Font:
Use Inter (Recommended) or Poppins for healthcare UI.

font-family: 'Inter', sans-serif;
Text Colors:
Primary: text-gray-800

Secondary: text-gray-600

Muted: text-gray-400

Headings:
Clean, bold, readable

Avoid fancy gradients (keep professional)

🧩 3. Core UI Components
🟦 Cards (Medical Style)
Use clean cards instead of glass/neon:

.med-card {
  @apply bg-white border border-gray-200 rounded-xl shadow-sm p-4 transition-all duration-200;
}
Hover:

hover:shadow-md
👉 Use for:

Reports

Predictions

Patient history

🔘 Buttons
Primary Button (Main Action)
.btn-primary {
  @apply bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition;
}
Secondary Button
.btn-outline {
  @apply border border-blue-500 text-blue-600 px-4 py-2 rounded-lg hover:bg-blue-50;
}
Soft Button (Low Priority)
.btn-soft {
  @apply text-gray-600 hover:bg-gray-100 px-3 py-2 rounded-md;
}
🧾 Inputs
.input-field {
  @apply w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500;
}
👉 Used for:

Image upload forms

Patient details

Search

📊 4. Special UI Components for Your Project
📸 Image Upload Box
Drag & Drop UI

Clear border

Icon + instructions

<div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center">
  Upload Skin Image
</div>
📈 Prediction Result Card
Include:

Disease name

Risk percentage

Color-coded status

Example:

🟢 Low Risk

🟡 Moderate Risk

🔴 High Risk

🔥 Heatmap Display (Grad-CAM)
Show original image + heatmap overlay

Keep clean (no heavy styling)

📄 Report Section
Structured layout

Printable format

Include:

Prediction

Confidence

Recommendation

✨ 5. Animations (Minimal & Clean)
Avoid flashy neon effects ❌

Use subtle animations:

Entrance:
.animate-fade {
  opacity: 0;
  transform: translateY(10px);
  animation: fadeUp 0.4s ease forwards;
}
Hover:
transition-all duration-200
Loading:
Skeleton loader

Spinner

📱 6. UI Philosophy (Healthcare Focus)
Always ensure:

✅ Clean & distraction-free UI
✅ Easy readability for all age groups
✅ Mobile-friendly design
✅ Accessible color contrast
✅ Trustworthy look (no flashy neon effects)

✅ 7. Best Practices Checklist
 Does UI look clean and medical (not gaming/hacker)?

 Are colors soft and trustworthy?

 Are risk levels clearly visible?

 Is the layout simple and readable?

 Are components reusable?

 Is it responsive on mobile?

🚀 8. Feature-Based UI Sections
Design UI for:

👤 User Side:
Upload Image

View Prediction

Download Report

History Tracking

🏥 Admin / Hospital Side:
Dashboard

Model training status

Federated learning updates

🎯 Final Design Goal
Build a UI that feels like a real medical application, not a tech demo.

It should feel:

Safe

Professional

Reliable

Easy to use