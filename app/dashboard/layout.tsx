import "./readability.css";

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <div className="representative-readable">{children}</div>;
}
