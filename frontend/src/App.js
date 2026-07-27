import "@/App.css";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import DesignStudioPage from "@/pages/DesignStudioPage";
import StaffDashboardPage from "@/pages/StaffDashboardPage";
import ManagerSettingsPage from "@/pages/ManagerSettingsPage";
import CustomerOrdersPage from "@/pages/CustomerOrdersPage";
import { LoginPage } from "@/pages/SupportingPages";

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" richColors />
      <Routes>
        <Route path="/" element={<DesignStudioPage />} />
        <Route path="/studio" element={<DesignStudioPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<LoginPage signup />} />
        <Route path="/orders" element={<CustomerOrdersPage />} />
        <Route path="/staff/login" element={<LoginPage staff />} />
        <Route path="/staff/settings" element={<ManagerSettingsPage />} />
        <Route path="/staff/*" element={<StaffDashboardPage />} />
        <Route path="*" element={<DesignStudioPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
