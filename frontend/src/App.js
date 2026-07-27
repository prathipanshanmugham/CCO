import "@/App.css";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import HomePage from "@/pages/HomePage";
import DesignStudioPage from "@/pages/DesignStudioPage";
import StaffDashboardPage from "@/pages/StaffDashboardPage";
import { EditorialPage, LoginPage, OrdersPage, ProfilePage, VaultPage, ViewerPage } from "@/pages/SupportingPages";

const editorialRoutes = {
  "/how-it-works": ["The journey is part of the jewel.", "The Clelia process", "Every commission begins with a conversation—then moves with intention through design, craft, and a final handover."],
  "/inspiration": ["Ideas with a life of their own.", "The inspiration gallery", "A considered selection of past forms, shared with permission and made to spark your next idea."],
  "/care": ["Made to be worn, kept to be loved.", "Care & craftsmanship", "Enduring beauty needs thoughtful care. Our atelier remains available throughout the life of your Clelia piece."],
  "/contact": ["A private conversation awaits.", "Contact the atelier", "Share a question, book a private consultation, or begin your bespoke story with our client advisors."],
  "/policies": ["A relationship built on clarity.", "Our policies", "Explore care, exchange, delivery and the promises that protect every Clelia commission."],
};

function App() { return <BrowserRouter><Toaster position="top-center" richColors /><Routes><Route path="/" element={<HomePage />} /><Route path="/studio" element={<DesignStudioPage />} /><Route path="/vault" element={<VaultPage />} /><Route path="/orders" element={<OrdersPage />} /><Route path="/profile" element={<ProfilePage />} /><Route path="/viewer" element={<ViewerPage />} /><Route path="/ar-try-on" element={<ViewerPage ar />} /><Route path="/login" element={<LoginPage />} /><Route path="/staff/login" element={<LoginPage staff />} /><Route path="/staff/*" element={<StaffDashboardPage />} />{Object.entries(editorialRoutes).map(([path, [title, eyebrow, copy]]) => <Route key={path} path={path} element={<EditorialPage title={title} eyebrow={eyebrow} copy={copy} />} />)}<Route path="*" element={<HomePage />} /></Routes></BrowserRouter>; }

export default App;
