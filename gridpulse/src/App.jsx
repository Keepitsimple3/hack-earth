import { BrowserRouter as Router, Routes, Route, Link } from "react-router-dom";
import { QRCodePage } from "./pages/qrcode";
import { Overview } from "./pages/overview";

export default function App() {
  return (
    <Router>
      <nav style={{ padding: 10 }}>
        <Link to="/">Overview</Link> |{" "}
        <Link to="/qrcode">QR Code</Link>
      </nav>

      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/qrcode" element={<QRCodePage />} />
      </Routes>
    </Router>
  );
}
