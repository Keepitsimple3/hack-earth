import React from "react";
import { QRCodeCanvas } from "qrcode.react";

export function QRCodePage() {
  return (
    <div style={{ padding: 30, textAlign: "center" }}>
      <h1> Join GridPulse</h1>
      <p>Scan this QR code to opt in during peak events.</p>

      <div style={{ marginTop: 20 }}>
        <QRCodeCanvas
          value="https://example.com"
          size={220}
        />
      </div>
    </div>
  );
}
