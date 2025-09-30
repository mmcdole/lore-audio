import { MiniPlayer } from "@/components/player/mini-player";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background overflow-x-hidden">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar />
        <main className="flex-1 space-y-6 px-4 pb-24 pt-6 lg:px-8 overflow-x-hidden">{children}</main>
        <MiniPlayer />
      </div>
    </div>
  );
}
