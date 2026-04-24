import "./globals.css";

export const metadata = {
  title: "ATO Copilot",
  description: "Junior Analyst for Prep Teams",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
