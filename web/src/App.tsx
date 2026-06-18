import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import BuildingPage from "./pages/BuildingPage";
import LandingPage from "./pages/LandingPage";
import NotFoundPage from "./pages/NotFoundPage";
import PortfolioPage from "./pages/PortfolioPage";
import SearchPage from "./pages/SearchPage";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/search" element={<SearchPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/building/:id" element={<BuildingPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
